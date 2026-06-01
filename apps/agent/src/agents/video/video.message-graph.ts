import { PromptBuilder } from '../../harness/prompt/builder.js';
import { SchemaParser } from '../../harness/output/schema-parser.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { ContentVectorCache } from '../../harness/core/types.js';
import type { ToolRegistry } from '../../harness/tool/tool.js';
import type { MessageGraphNodeContext, MessageEnvelope, MessageGraphRouteFn } from '../../harness/runtime/message-graph.js';
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
} from './video.prompts.js';
import type { StoryboardScene, StoryboardRaw } from './video.types.js';
import type { ManimRunnerResult } from '../../tools/manim-runner.tool.js';
import type { ModelGovernanceConfig } from '../../harness/runtime/model-governance.js';

const schemaParser = new SchemaParser();
const MAX_MANIM_RETRIES = 3;

interface CacheEvent {
  cacheHit: boolean;
  videoUrl?: string;
}

interface ScriptEvent {
  manimScript: string;
  scriptVersion: number;
}

interface RenderEvent {
  renderedVideoPath?: string;
  lastError?: string;
  errorType?: 'syntax' | 'import' | 'name' | 'attribute' | 'latex' | 'timeout' | 'runtime' | 'unknown';
}

export function buildVideoMessageGraphNodes(
  llm: LLMClient,
  videoCache: ContentVectorCache,
  toolRegistry: ToolRegistry,
  modelConfig: ModelGovernanceConfig['video'],
) {
  async function checkCacheNode(ctx: MessageGraphNodeContext): Promise<void> {
    const state = ctx.getWorkflowState();
    const useVideoCache = state.useVideoCache !== false;
    if (!useVideoCache) {
      const payload: CacheEvent = { cacheHit: false };
      ctx.setNodeState(payload);
      ctx.emitEvent('video.check_cache.completed', payload);
      return;
    }
    const description = String(state.knowledgeDescription ?? '');
    const threshold = Number(state.cacheScoreThreshold ?? 0.92);
    const hits = await videoCache.search(description, 1);
    const top = hits[0];
    if (top && (top.score ?? 0) >= threshold) {
      const payload: CacheEvent = {
        cacheHit: true,
        videoUrl: (top.payload as { videoUrl?: string } | undefined)?.videoUrl,
      };
      ctx.setNodeState(payload);
      ctx.emitEvent('video.check_cache.completed', payload);
      return;
    }
    const payload: CacheEvent = { cacheHit: false };
    ctx.setNodeState(payload);
    ctx.emitEvent('video.check_cache.completed', payload);
  }

  async function returnCachedNode(ctx: MessageGraphNodeContext): Promise<void> {
    const cache = findLatestEvent<CacheEvent>(ctx.readEvents('video.check_cache.completed'));
    const payload = { success: true, videoUrl: cache?.videoUrl };
    ctx.setNodeState(payload);
    ctx.emitEvent('video.return_cached.completed', payload);
  }

  async function generateStoryboardNode(ctx: MessageGraphNodeContext): Promise<void> {
    const state = ctx.getWorkflowState();
    const knowledge = String(state.knowledgeDescription ?? '');
    const subject = String(state.subject ?? '');
    const { messages, systemPrompt } = new PromptBuilder()
      .setPersona(VIDEO_PERSONA, {})
      .setTask(STORYBOARD_TASK, { knowledge, subject })
      .setOutputFormat(STORYBOARD_OUTPUT_SCHEMA)
      .build();
    const response = await llm.call({
      model: modelConfig.generateStoryboard,
      messages,
      systemPrompt,
      maxTokens: 2000,
    });
    const raw = schemaParser.parse<StoryboardRaw>(response.content, STORYBOARD_OUTPUT_SCHEMA);
    const storyboard: StoryboardScene[] = (raw.scenes as unknown[]).map((scene, index) => {
      const item = scene as Record<string, unknown>;
      return {
        sceneIndex: index,
        description: String(item.description ?? ''),
        animationNotes: String(item.animation_notes ?? ''),
        narration: String(item.narration ?? ''),
        durationSeconds: Number(item.duration_seconds ?? 15),
      };
    });
    ctx.setNodeState({ sceneCount: storyboard.length });
    ctx.setArtifact('video.storyboard', storyboard);
    ctx.emitEvent('video.storyboard.completed', { storyboard });
  }

  async function generateScriptNode(ctx: MessageGraphNodeContext): Promise<void> {
    const storyboard = ctx.getArtifact('video.storyboard') as StoryboardScene[] | undefined;
    if (!storyboard?.length) {
      throw new Error('StoryboardMissing');
    }
    const storyboardText = storyboard
      .map((s) => `场景 ${s.sceneIndex + 1}:\n描述: ${s.description}\n动画: ${s.animationNotes}\n旁白: ${s.narration}`)
      .join('\n\n');
    const loop = await runReasoningLoop<string>({
      maxAttempts: 2,
      run: async ({ feedback }) => {
        const { messages, systemPrompt } = new PromptBuilder()
          .setPersona(VIDEO_PERSONA, {})
          .setTask(MANIM_SCRIPT_TASK, {
            storyboard: feedback ? `${storyboardText}\n\n反馈：${feedback}` : storyboardText,
          })
          .build();
        const response = await llm.call({
          model: modelConfig.generateScript,
          messages,
          systemPrompt,
          maxTokens: 4000,
        });
        const codeMatch = response.content.match(/```python\s*([\s\S]*?)```/);
        const script = (codeMatch ? codeMatch[1].trim() : response.content).trim();
        if (!script) throw new Error('ScriptParseFailed');
        return script;
      },
      verify: async (script) => validateManimScript(script),
    });
    if (!loop.success || !loop.result) {
      throw new Error(loop.failureReason ?? 'GenerateScriptFailed');
    }
    const currentVersion = Number(ctx.getWorkflowState().scriptVersion ?? 0) + 1;
    ctx.patchWorkflowState({ scriptVersion: currentVersion });
    const payload: ScriptEvent = {
      manimScript: loop.result,
      scriptVersion: currentVersion,
    };
    ctx.setArtifact('video.script', loop.result);
    ctx.setNodeState({ scriptVersion: currentVersion });
    ctx.emitEvent('video.script.completed', payload);
  }

  async function renderNode(ctx: MessageGraphNodeContext): Promise<void> {
    const script = resolveCurrentScript(ctx.readEvents());
    if (!script) {
      throw new Error('ScriptMissing');
    }
    const tool = toolRegistry.get('manim_runner');
    if (!tool) {
      throw new Error('ManimToolMissing');
    }
    const result = (await tool.execute({
      script,
      output_name: `video_${Date.now()}`,
    })) as ManimRunnerResult;
    if (result.success && result.video_path) {
      const payload: RenderEvent = { renderedVideoPath: result.video_path };
      ctx.setArtifact('video.rendered_path', result.video_path);
      ctx.setNodeState(payload);
      ctx.emitEvent('video.render.completed', payload);
      return;
    }
    const lastError = result.error_message ?? result.stderr ?? 'UnknownRenderError';
    const classified = classifyManimError(lastError);
    const retryCount = Number(ctx.getWorkflowState().retryCount ?? 0) + 1;
    ctx.patchWorkflowState({ retryCount, lastError, errorType: classified.type });
    const payload: RenderEvent = {
      lastError,
      errorType: classified.type,
    };
    ctx.setNodeState({ ...payload, retryCount });
    ctx.emitEvent('video.render.completed', payload);
  }

  async function fixScriptNode(ctx: MessageGraphNodeContext): Promise<void> {
    const script = resolveCurrentScript(ctx.readEvents());
    const render = findLatestEvent<RenderEvent>(ctx.readEvents('video.render.completed'));
    if (!script || !render?.lastError) {
      throw new Error('FixInputMissing');
    }
    const retryCount = Number(ctx.getWorkflowState().retryCount ?? 0);
    const errorType = render.errorType ?? 'unknown';
    const strategy = chooseFixStrategy(errorType, retryCount);

    if (strategy === 'rule') {
      const patched = applyRulePatch(script, errorType, render.lastError);
      if (patched.applied) {
        const validationErrors = validateManimScript(patched.script);
        if (!validationErrors.length) {
          const nextVersion = Number(ctx.getWorkflowState().scriptVersion ?? 0) + 1;
          ctx.patchWorkflowState({ scriptVersion: nextVersion });
          const payload: ScriptEvent = {
            manimScript: patched.script,
            scriptVersion: nextVersion,
          };
          ctx.setArtifact('video.script', patched.script);
          ctx.emitEvent('video.fix.completed', payload);
          return;
        }
      }
    }

    const loop = await runReasoningLoop<string>({
      maxAttempts: strategy === 'full_rewrite' ? 2 : 1,
      run: async () => {
        const { messages, systemPrompt } = new PromptBuilder()
          .setPersona(VIDEO_PERSONA, {})
          .setTask(MANIM_FIX_TASK, {
            script,
            error: render.lastError ?? '',
          })
          .build();
        const response = await llm.call({
          model: modelConfig.fixScript,
          messages,
          systemPrompt,
          maxTokens: 4000,
        });
        const codeMatch = response.content.match(/```python\s*([\s\S]*?)```/);
        return (codeMatch ? codeMatch[1].trim() : response.content).trim();
      },
      verify: async (candidate) => validateManimScript(candidate),
    });

    if (!loop.success || !loop.result) {
      throw new Error(loop.failureReason ?? 'FixScriptFailed');
    }
    const nextVersion = Number(ctx.getWorkflowState().scriptVersion ?? 0) + 1;
    ctx.patchWorkflowState({ scriptVersion: nextVersion });
    const payload: ScriptEvent = {
      manimScript: loop.result,
      scriptVersion: nextVersion,
    };
    ctx.setArtifact('video.script', loop.result);
    ctx.emitEvent('video.fix.completed', payload);
  }

  async function uploadNode(ctx: MessageGraphNodeContext): Promise<void> {
    const renderedVideoPath = ctx.getArtifact('video.rendered_path');
    if (typeof renderedVideoPath !== 'string' || renderedVideoPath.length === 0) {
      throw new Error('RenderedVideoMissing');
    }
    const uploadTool = toolRegistry.get('storage_upload');
    if (!uploadTool) {
      throw new Error('UploadToolMissing');
    }
    const result = (await uploadTool.execute({
      file_path: renderedVideoPath,
      object_key: `videos/${Date.now()}.mp4`,
    })) as { success: boolean; url?: string; error_message?: string };
    if (result.success && result.url) {
      const payload = { success: true, videoUrl: result.url };
      ctx.patchWorkflowState({ success: true, videoUrl: result.url });
      ctx.setNodeState(payload);
      ctx.emitEvent('video.upload.completed', payload);
      return;
    }
    const payload = { success: false, failureReason: result.error_message ?? 'UploadFailed' };
    ctx.patchWorkflowState(payload);
    ctx.setNodeState(payload);
    ctx.emitEvent('video.upload.completed', payload);
  }

  const shouldUseCached: MessageGraphRouteFn = (_partitions, events) => {
    const cache = findLatestEvent<CacheEvent>(events.filter((event) => event.event_type === 'video.check_cache.completed'));
    return cache?.cacheHit ? 'cached' : 'generate';
  };

  const shouldRetryRender: MessageGraphRouteFn = (partitions, events) => {
    const render = findLatestEvent<RenderEvent>(events.filter((event) => event.event_type === 'video.render.completed'));
    if (render?.renderedVideoPath) return 'upload';
    const retryCount = Number(partitions.workflow_state.retryCount ?? 0);
    if (render?.lastError && retryCount < MAX_MANIM_RETRIES) return 'retry';
    return 'fail';
  };

  return {
    checkCacheNode,
    returnCachedNode,
    generateStoryboardNode,
    generateScriptNode,
    renderNode,
    fixScriptNode,
    uploadNode,
    shouldUseCached,
    shouldRetryRender,
  };
}

function findLatestEvent<TPayload>(events: readonly MessageEnvelope[]): TPayload | undefined {
  if (!events.length) return undefined;
  return events[events.length - 1]?.payload as TPayload;
}

function resolveCurrentScript(events: readonly MessageEnvelope[]): string | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.event_type === 'video.fix.completed' || event.event_type === 'video.script.completed') {
      const payload = event.payload as { manimScript?: string };
      if (typeof payload.manimScript === 'string' && payload.manimScript.length > 0) {
        return payload.manimScript;
      }
    }
  }
  return undefined;
}
