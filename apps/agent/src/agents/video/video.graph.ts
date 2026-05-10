/**
 * Video Agent Graph 节点定义
 * 流程：缓存检查 → 分镜脚本 → Manim 脚本 → 渲染（含重试）→ 上传
 */

import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import { END } from '../../harness/core/graph.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { ContentVectorCache } from '../../harness/core/types.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import { MODELS } from '../../constants/models.js';
import { runReasoningLoop } from '../../harness/reasoning/loop.js';
import { validateManimScript } from '../../harness/video/script-validator.js';
import { classifyManimError } from '../../harness/video/error-classifier.js';
import { applyRulePatch, chooseFixStrategy } from '../../harness/video/fix-policy.js';
import {
  VIDEO_PERSONA,
  STORYBOARD_TASK,
  MANIM_SCRIPT_TASK,
  MANIM_FIX_TASK,
  STORYBOARD_OUTPUT_SCHEMA,
  MANIM_SCRIPT_OUTPUT_SCHEMA,
} from './video.prompts.js';
import type { VideoState, StoryboardRaw, ManimScriptRaw, StoryboardScene } from './video.types.js';
import type { ManimRunnerResult } from '../../tools/manim-runner.tool.js';

const MAX_MANIM_RETRIES = 3;
const schemaParser = new SchemaParser();

export function buildVideoNodes(
  llm: LLMClient,
  videoCache: ContentVectorCache,
  toolRegistry: ToolRegistry,
) {
  async function checkCacheNode(state: Readonly<VideoState>): Promise<Partial<VideoState>> {
    if (!state.useVideoCache) return { cacheHit: false };

    const hits = await videoCache.search(state.knowledgeDescription, 1);
    const top = hits[0];

    if (top && (top.score ?? 0) >= state.cacheScoreThreshold) {
      const payload = top.payload as { videoUrl: string };
      return { cacheHit: true, videoUrl: payload.videoUrl, success: true };
    }

    return { cacheHit: false };
  }

  async function generateStoryboardNode(state: Readonly<VideoState>): Promise<Partial<VideoState>> {
    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(VIDEO_PERSONA, {})
      .setTask(STORYBOARD_TASK, {
        knowledge: state.knowledgeDescription,
        subject: state.subject,
      })
      .setOutputFormat(STORYBOARD_OUTPUT_SCHEMA)
      .build();

    const response = await llm.call({
      model: MODELS.SONNET,
      messages,
      systemPrompt,
      maxTokens: 2000,
    });

    try {
      const raw = schemaParser.parse<StoryboardRaw>(response.content, STORYBOARD_OUTPUT_SCHEMA);
      const storyboard: StoryboardScene[] = (raw.scenes as unknown[]).map((s, i) => {
        const scene = s as Record<string, unknown>;
        return {
          sceneIndex: i,
          description: String(scene.description ?? ''),
          animationNotes: String(scene.animation_notes ?? ''),
          narration: String(scene.narration ?? ''),
          durationSeconds: Number(scene.duration_seconds ?? 15),
        };
      });
      return { storyboard };
    } catch {
      return { failureReason: '分镜脚本生成失败', success: false };
    }
  }

  async function generateManimScriptNode(
    state: Readonly<VideoState>,
  ): Promise<Partial<VideoState>> {
    if (!state.storyboard) return { failureReason: '无分镜脚本', success: false };

    const storyboardText = state.storyboard
      .map((s) => `场景 ${s.sceneIndex + 1}:\n  描述: ${s.description}\n  动画: ${s.animationNotes}\n  旁白: ${s.narration}\n  时长: ${s.durationSeconds}s`)
      .join('\n\n');

    const loop = await runReasoningLoop<string>({
      maxAttempts: 2,
      run: async ({ feedback }) => {
        const taskVars = {
          storyboard: feedback
            ? `${storyboardText}\n\n### 上轮失败反馈\n${feedback}`
            : storyboardText,
        };
        const { messages, systemPrompt } = new PromptBuilder()
          .setPersona(VIDEO_PERSONA, {})
          .setTask(MANIM_SCRIPT_TASK, taskVars)
          .setOutputFormat(MANIM_SCRIPT_OUTPUT_SCHEMA)
          .build();

        const response = await llm.call({
          model: MODELS.SONNET,
          messages,
          systemPrompt,
          maxTokens: 4000,
        });

        try {
          const raw = schemaParser.parse<ManimScriptRaw>(response.content, MANIM_SCRIPT_OUTPUT_SCHEMA);
          return raw.script;
        } catch {
          const codeMatch = response.content.match(/```python\s*([\s\S]*?)```/);
          if (codeMatch) return codeMatch[1].trim();
          throw new Error('模型未返回可解析脚本');
        }
      },
      verify: async (script) => validateManimScript(script),
    });

    if (!loop.success || !loop.result) {
      const verificationErrors =
        loop.attempts[loop.attempts.length - 1]?.verificationErrors.join('；') ?? '';
      return {
        failureReason: loop.failureReason ?? 'Manim 脚本生成失败',
        validationReport: verificationErrors || undefined,
        success: false,
      };
    }

    return {
      manimScript: loop.result,
      scriptVersion: (state.scriptVersion ?? 0) + 1,
      validationReport: undefined,
    };
  }

  async function renderManimNode(state: Readonly<VideoState>): Promise<Partial<VideoState>> {
    if (!state.manimScript) return { failureReason: '无 Manim 脚本', success: false };
    if (state.retryCount >= MAX_MANIM_RETRIES) {
      return { success: false, failureReason: `Manim 渲染失败，已重试 ${MAX_MANIM_RETRIES} 次` };
    }

    const manimTool = toolRegistry.get('manim_runner');
    if (!manimTool) return { success: false, failureReason: 'manim_runner 工具未注册' };

    const result = (await manimTool.execute({
      script: state.manimScript,
      output_name: `video_${Date.now()}`,
    })) as ManimRunnerResult;

    if (result.success && result.video_path) {
      return { renderedVideoPath: result.video_path, lastError: undefined };
    }

    const lastError = result.error_message ?? result.stderr ?? '未知渲染错误';
    const classified = classifyManimError(lastError);
    return {
      lastError,
      errorType: classified.type,
      retryCount: state.retryCount + 1,
    };
  }

  async function fixManimScriptNode(
    state: Readonly<VideoState>,
  ): Promise<Partial<VideoState>> {
    if (!state.manimScript || !state.lastError) return {};
    const currentScript = state.manimScript;
    const currentError = state.lastError;
    const errorType = state.errorType ?? 'unknown';
    const strategy = chooseFixStrategy(errorType, state.retryCount);

    if (strategy === 'rule') {
      const patched = applyRulePatch(currentScript, errorType, currentError);
      if (patched.applied) {
        const errors = validateManimScript(patched.script);
        return {
          manimScript: patched.script,
          fixStrategy: strategy,
          validationReport: errors.length ? errors.join('；') : undefined,
          fixHistory: [
            ...(state.fixHistory ?? []),
            { attempt: state.retryCount, strategy, reason: patched.reason },
          ],
        };
      }
    }

    const loop = await runReasoningLoop<string>({
      maxAttempts: strategy === 'full_rewrite' ? 2 : 1,
      run: async ({ feedback }) => {
        const { messages, systemPrompt } = new PromptBuilder()
          .setPersona(VIDEO_PERSONA, {})
          .setTask(MANIM_FIX_TASK, {
            script: currentScript,
            error: currentError,
            errorType,
            strategy,
            validationFeedback: feedback ?? '',
          })
          .build();

        const response = await llm.call({
          model: MODELS.SONNET,
          messages,
          systemPrompt,
          maxTokens: 4000,
        });

        const codeMatch = response.content.match(/```python\s*([\s\S]*?)```/);
        return (codeMatch ? codeMatch[1].trim() : response.content).trim();
      },
      verify: async (script) => validateManimScript(script),
    });

    if (!loop.success || !loop.result) {
      return {
        fixStrategy: strategy,
        failureReason: loop.failureReason ?? '脚本修复失败',
        fixHistory: [
          ...(state.fixHistory ?? []),
          { attempt: state.retryCount, strategy, reason: '修复失败' },
        ],
      };
    }

    return {
      manimScript: loop.result,
      fixStrategy: strategy,
      scriptVersion: state.scriptVersion + 1,
      validationReport: undefined,
      fixHistory: [
        ...(state.fixHistory ?? []),
        { attempt: state.retryCount, strategy, reason: '修复并通过校验' },
      ],
    };
  }

  async function uploadVideoNode(state: Readonly<VideoState>): Promise<Partial<VideoState>> {
    if (!state.renderedVideoPath) return { success: false, failureReason: '无渲染产物' };

    const uploadTool = toolRegistry.get('storage_upload');
    if (!uploadTool) return { success: false, failureReason: 'storage_upload 工具未注册' };

    const objectKey = `videos/${Date.now()}.mp4`;
    const result = (await uploadTool.execute({
      file_path: state.renderedVideoPath,
      object_key: objectKey,
    })) as { success: boolean; url?: string; error_message?: string };

    if (result.success && result.url) {
      return { videoUrl: result.url, success: true };
    }

    return { success: false, failureReason: result.error_message ?? '上传失败' };
  }

  function shouldUseCached(state: Readonly<VideoState>): 'cached' | 'generate' {
    return state.cacheHit ? 'cached' : 'generate';
  }

  function shouldRetryRender(
    state: Readonly<VideoState>,
  ): 'retry' | 'upload' | 'fail' {
    if (state.renderedVideoPath) return 'upload';
    if (state.retryCount < MAX_MANIM_RETRIES && state.lastError) return 'retry';
    return 'fail';
  }

  function alwaysFail(_state: Readonly<VideoState>): 'end' {
    return 'end';
  }

  return {
    checkCacheNode,
    generateStoryboardNode,
    generateManimScriptNode,
    renderManimNode,
    fixManimScriptNode,
    uploadVideoNode,
    shouldUseCached,
    shouldRetryRender,
    alwaysFail,
    END,
  };
}
