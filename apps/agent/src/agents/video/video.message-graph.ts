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
  createRunBundleArchive,
  finalizeRunManifest,
  writeRunJson,
  writeRunText,
} from '../../harness/artifact/video-run-artifact.js';
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

interface RunArtifactState {
  runId?: string;
  workflowId?: string;
  traceId?: string;
  artifactRunDir?: string;
  artifactObjectPrefix?: string;
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
    const artifactState = readRunArtifactState(ctx);
    await writeRunJsonIfEnabled(artifactState, 'result.json', {
      success: true,
      reason: 'cache_hit',
      videoUrl: cache?.videoUrl ?? '',
      timestamp: new Date().toISOString(),
    });
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
      const sceneIndexFromModel = Number(item.scene_index ?? index + 1);
      const normalizedSceneIndex =
        Number.isFinite(sceneIndexFromModel) && sceneIndexFromModel > 0 ? sceneIndexFromModel - 1 : index;
      const layoutValue = String(item.layout ?? 'center').trim().toLowerCase();
      const layout: StoryboardScene['layout'] = layoutValue === 'left_right' ? 'left_right' : 'center';
      const subtitles = Array.isArray(item.subtitles)
        ? item.subtitles
            .map((line) => String(line).trim())
            .filter((line) => line.length > 0)
        : [];
      return {
        sceneIndex: normalizedSceneIndex,
        title: String(item.title ?? `场景 ${index + 1}`),
        layout,
        description: String(item.description ?? ''),
        animationNotes: String(item.animation_notes ?? ''),
        narration: String(item.narration ?? ''),
        subtitles,
        durationSeconds: Number(item.duration_seconds ?? 15),
      };
    });
    await writeRunJsonIfEnabled(readRunArtifactState(ctx), 'storyboard.json', {
      scenes: storyboard,
      generatedAt: new Date().toISOString(),
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
    const storyboardJson = JSON.stringify(storyboard, null, 2);
    const loop = await runReasoningLoop<string>({
      maxAttempts: 2,
      run: async ({ feedback }) => {
        const { messages, systemPrompt } = new PromptBuilder()
          .setPersona(VIDEO_PERSONA, {})
          .setTask(MANIM_SCRIPT_TASK, {
            storyboard: feedback ? `${storyboardJson}\n\n反馈：${feedback}` : storyboardJson,
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
    const artifactState = readRunArtifactState(ctx);
    await writeRunTextIfEnabled(artifactState, `scripts/script-v${currentVersion}.py`, `${loop.result}\n`);
    await writeRunJsonIfEnabled(artifactState, `scripts/script-v${currentVersion}.meta.json`, {
      source: 'generate',
      attemptCount: loop.attempts.length,
      generatedAt: new Date().toISOString(),
      verificationErrors:
        loop.attempts[loop.attempts.length - 1]?.verificationErrors ?? [],
    });
    ctx.setArtifact('video.script', loop.result);
    ctx.setNodeState({ scriptVersion: currentVersion });
    ctx.emitEvent('video.script.completed', payload);
  }

  async function renderNode(ctx: MessageGraphNodeContext): Promise<void> {
    const artifactState = readRunArtifactState(ctx);
    const attempt = ctx.readEvents('video.render.completed').length + 1;
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
      await writeRunJsonIfEnabled(artifactState, `render/render-attempt-${attempt}.json`, {
        attempt,
        success: true,
        renderedVideoPath: result.video_path,
        createdAt: new Date().toISOString(),
      });
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
    await writeRunJsonIfEnabled(artifactState, `render/render-attempt-${attempt}.json`, {
      attempt,
      success: false,
      errorType: classified.type,
      lastError,
      createdAt: new Date().toISOString(),
    });
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
          const artifactState = readRunArtifactState(ctx);
          ctx.patchWorkflowState({ scriptVersion: nextVersion });
          const payload: ScriptEvent = {
            manimScript: patched.script,
            scriptVersion: nextVersion,
          };
          await writeRunTextIfEnabled(artifactState, `scripts/script-v${nextVersion}.py`, `${patched.script}\n`);
          await writeRunJsonIfEnabled(artifactState, `scripts/script-v${nextVersion}.meta.json`, {
            source: 'fix_rule',
            strategy,
            reason: patched.reason,
            generatedAt: new Date().toISOString(),
          });
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
    const artifactState = readRunArtifactState(ctx);
    ctx.patchWorkflowState({ scriptVersion: nextVersion });
    const payload: ScriptEvent = {
      manimScript: loop.result,
      scriptVersion: nextVersion,
    };
    await writeRunTextIfEnabled(artifactState, `scripts/script-v${nextVersion}.py`, `${loop.result}\n`);
    await writeRunJsonIfEnabled(artifactState, `scripts/script-v${nextVersion}.meta.json`, {
      source: 'fix_llm',
      strategy,
      attemptCount: loop.attempts.length,
      generatedAt: new Date().toISOString(),
    });
    ctx.setArtifact('video.script', loop.result);
    ctx.emitEvent('video.fix.completed', payload);
  }

  async function uploadNode(ctx: MessageGraphNodeContext): Promise<void> {
    const renderedVideoPath = ctx.getArtifact('video.rendered_path');
    const artifactState = readRunArtifactState(ctx);
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
      await writeRunJsonIfEnabled(artifactState, 'result.json', {
        success: true,
        videoUrl: result.url,
        createdAt: new Date().toISOString(),
      });
      let artifactBundleUrl: string | undefined;
      let artifactManifestUrl: string | undefined;
      const runArtifactContext = toRunArtifactContext(artifactState);
      if (runArtifactContext) {
        await finalizeRunManifest(runArtifactContext);
        const archivePath = await createRunBundleArchive(runArtifactContext);
        const archiveUpload = (await uploadTool.execute({
          file_path: archivePath,
          object_key: `${artifactState.artifactObjectPrefix}/run-bundle.tar.gz`,
          content_type: 'application/gzip',
        })) as { success: boolean; url?: string };
        const manifestUpload = (await uploadTool.execute({
          file_path: `${artifactState.artifactRunDir}/manifest.json`,
          object_key: `${artifactState.artifactObjectPrefix}/manifest.json`,
          content_type: 'application/json',
        })) as { success: boolean; url?: string };
        if (archiveUpload.success) artifactBundleUrl = archiveUpload.url;
        if (manifestUpload.success) artifactManifestUrl = manifestUpload.url;
      }
      const payload = {
        success: true,
        videoUrl: result.url,
        artifactBundleUrl,
        artifactManifestUrl,
      };
      await writeRunJsonIfEnabled(artifactState, 'result.json', {
        ...payload,
        createdAt: new Date().toISOString(),
      });
      ctx.patchWorkflowState({
        success: true,
        videoUrl: result.url,
        artifactBundleUrl,
        artifactManifestUrl,
      });
      ctx.setNodeState(payload);
      ctx.emitEvent('video.upload.completed', payload);
      return;
    }
    const payload = { success: false, failureReason: result.error_message ?? 'UploadFailed' };
    await writeRunJsonIfEnabled(artifactState, 'result.json', {
      ...payload,
      createdAt: new Date().toISOString(),
    });
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

function readRunArtifactState(ctx: MessageGraphNodeContext): RunArtifactState {
  const state = ctx.getWorkflowState();
  return {
    runId: typeof state.runId === 'string' ? state.runId : undefined,
    workflowId: typeof state.workflowId === 'string' ? state.workflowId : undefined,
    traceId: typeof state.traceId === 'string' ? state.traceId : undefined,
    artifactRunDir: typeof state.artifactRunDir === 'string' ? state.artifactRunDir : undefined,
    artifactObjectPrefix: typeof state.artifactObjectPrefix === 'string' ? state.artifactObjectPrefix : undefined,
  };
}

function toRunArtifactContext(state: RunArtifactState):
  | {
      runId: string;
      workflowId: string;
      traceId: string;
      rootDir: string;
      runDir: string;
      objectPrefix: string;
      createdAt: string;
    }
  | undefined {
  if (!state.runId || !state.artifactRunDir || !state.artifactObjectPrefix) return undefined;
  return {
    runId: state.runId,
    workflowId: state.workflowId ?? '',
    traceId: state.traceId ?? '',
    rootDir: state.artifactRunDir,
    runDir: state.artifactRunDir,
    objectPrefix: state.artifactObjectPrefix,
    createdAt: new Date().toISOString(),
  };
}

async function writeRunJsonIfEnabled(
  state: RunArtifactState,
  relativePath: string,
  payload: unknown,
): Promise<void> {
  if (!state.artifactRunDir) return;
  try {
    await writeRunJson(state.artifactRunDir, relativePath, payload);
  } catch {
    // 产物写入失败不阻断主流程
  }
}

async function writeRunTextIfEnabled(
  state: RunArtifactState,
  relativePath: string,
  content: string,
): Promise<void> {
  if (!state.artifactRunDir) return;
  try {
    await writeRunText(state.artifactRunDir, relativePath, content);
  } catch {
    // 产物写入失败不阻断主流程
  }
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
