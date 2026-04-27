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

    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(VIDEO_PERSONA, {})
      .setTask(MANIM_SCRIPT_TASK, { storyboard: storyboardText })
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
      return { manimScript: raw.script };
    } catch {
      // 如果 YAML 解析失败，尝试直接提取代码块
      const codeMatch = response.content.match(/```python\s*([\s\S]*?)```/);
      if (codeMatch) return { manimScript: codeMatch[1].trim() };
      return { failureReason: 'Manim 脚本生成失败', success: false };
    }
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

    return {
      lastError: result.error_message ?? result.stderr ?? '未知渲染错误',
      retryCount: state.retryCount + 1,
    };
  }

  async function fixManimScriptNode(
    state: Readonly<VideoState>,
  ): Promise<Partial<VideoState>> {
    if (!state.manimScript || !state.lastError) return {};

    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(VIDEO_PERSONA, {})
      .setTask(MANIM_FIX_TASK, {
        script: state.manimScript,
        error: state.lastError,
      })
      .build();

    const response = await llm.call({
      model: MODELS.SONNET,
      messages,
      systemPrompt,
      maxTokens: 4000,
    });

    const codeMatch = response.content.match(/```python\s*([\s\S]*?)```/);
    const fixedScript = codeMatch ? codeMatch[1].trim() : response.content;

    return { manimScript: fixedScript };
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
