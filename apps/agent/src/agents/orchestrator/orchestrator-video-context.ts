import { readFile } from 'fs/promises';
import { join } from 'path';
import type { OrchestratorInput, ImageSemanticOutput, VideoRunRecord } from './orchestrator.types.js';

export const VIDEO_CONTEXT_STATE_KEY = 'video_context';

const MODEL_CONTEXT_MAX_CHARS = 9000;
const ORIGINAL_TASK_MAX_CHARS = 2200;
const IMAGE_SEMANTIC_MAX_CHARS = 2200;
const PREVIOUS_VIDEO_MAX_CHARS = 3200;
const USER_INSTRUCTION_MAX_CHARS = 900;
const URL_PATTERN = /\b(?:https?:\/\/|s3:\/\/|cos:\/\/|oss:\/\/|file:\/\/)\S+/gi;

export interface PreviousVideoContent {
  storyboardSummary?: string;
  narrationSummary?: string;
  visualPlanSummary?: string;
}

export interface VideoConversationContext {
  version: 1;
  subject: string;
  originalUserMessage: string;
  currentKnowledgeDescription: string;
  modelFacingSummary: string;
  imageSemantic?: ImageSemanticOutput;
  previousVideoContent?: PreviousVideoContent;
  lastUserInstruction?: string;
  lastVideoRun?: {
    runId: string;
    videoUrl?: string;
    artifactBundleUrl?: string;
    artifactManifestUrl?: string;
    status: 'completed' | 'failed';
    failureReason?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VideoContextResolution {
  context: VideoConversationContext;
  mode: 'new_video' | 'regenerate' | 'revise_previous';
  knowledgeDescription: string;
  subject: string;
  useVideoCache: boolean;
  reason: string;
}

export interface VideoContextResolutionParams {
  input: OrchestratorInput;
  subject: string;
  imageSemantic?: ImageSemanticOutput;
  previousContext?: VideoConversationContext;
  qaAnswer?: string;
}

export function resolveVideoContext(params: VideoContextResolutionParams): VideoContextResolution {
  const { input, subject, imageSemantic, previousContext, qaAnswer } = params;
  const userMessage = input.userMessage.trim();
  const now = new Date().toISOString();
  const hasImages = getInputImages(input).length > 0;
  const followUpKind = classifyVideoFollowUp(userMessage);
  const usePrevious = !hasImages && previousContext && followUpKind;
  const mode = usePrevious ? followUpKind : 'new_video';
  const originalUserMessage = usePrevious ? previousContext.originalUserMessage : userMessage;
  const effectiveImageSemantic = usePrevious ? previousContext.imageSemantic : imageSemantic;
  const previousVideoContent = usePrevious ? previousContext.previousVideoContent : undefined;
  const modelFacingSummary = buildModelFacingSummary({
    originalUserMessage,
    imageSemantic: effectiveImageSemantic,
    previousVideoContent,
    currentUserMessage: usePrevious ? userMessage : undefined,
    qaAnswer,
    mode,
  });
  const context: VideoConversationContext = {
    version: 1,
    subject,
    originalUserMessage,
    currentKnowledgeDescription: modelFacingSummary,
    modelFacingSummary,
    imageSemantic: effectiveImageSemantic,
    previousVideoContent,
    lastUserInstruction: usePrevious ? userMessage : undefined,
    lastVideoRun: previousContext?.lastVideoRun,
    createdAt: previousContext?.createdAt ?? now,
    updatedAt: now,
  };

  return {
    context,
    mode,
    knowledgeDescription: modelFacingSummary,
    subject,
    useVideoCache: mode === 'new_video',
    reason: usePrevious
      ? `复用上一视频上下文处理 ${mode}`
      : hasImages
        ? '本轮包含图片，建立新视频上下文'
        : '本轮为新视频任务',
  };
}

export async function buildUpdatedVideoContext(params: {
  resolution: VideoContextResolution;
  videoRunRecord?: VideoRunRecord;
  success: boolean;
  videoUrl?: string;
  failureReason?: string;
}): Promise<VideoConversationContext> {
  const previousVideoContent = params.success && params.videoRunRecord
    ? await readPreviousVideoContent(params.videoRunRecord.artifactRunDir)
    : params.resolution.context.previousVideoContent;

  return {
    ...params.resolution.context,
    previousVideoContent,
    lastVideoRun: params.videoRunRecord
      ? {
          runId: params.videoRunRecord.runId,
          videoUrl: params.videoUrl,
          artifactBundleUrl: params.videoRunRecord.artifactBundleUrl,
          artifactManifestUrl: params.videoRunRecord.artifactManifestUrl,
          status: params.success ? 'completed' : 'failed',
          failureReason: params.failureReason,
        }
      : params.resolution.context.lastVideoRun,
    updatedAt: new Date().toISOString(),
  };
}

export function buildKnowledgeDescription(
  userMessage: string,
  imageSemantic?: ImageSemanticOutput,
  qaAnswer?: string,
): string {
  return buildModelFacingSummary({
    originalUserMessage: userMessage,
    imageSemantic,
    qaAnswer,
    mode: 'new_video',
  });
}

export function getInputImages(input: OrchestratorInput): Array<{ url: string; mediaType?: string }> {
  return (input.images ?? [])
    .filter((item) => item.url)
    .slice(0, 9);
}

export function hasVideoIntent(userMessage: string, hasImage: boolean): boolean {
  const text = userMessage.toLowerCase().replace(/\s+/g, '');
  const directVideoKeywords = [
    '生成视频',
    '讲解视频',
    '做个视频',
    '出视频',
    '视频讲解',
    '视频版',
    '录个视频',
    '制作视频',
    '生成动画',
    '做个动画',
    '重生成视频',
    '重新生成视频',
    '重新生一个',
    '再生一个',
    '重做',
    '重新渲染',
    '重渲染',
    '重新跑视频',
    '修视频',
    '修复视频',
    '视频有问题',
    '视频不对',
    '视频错误',
    '渲染失败',
    '渲染报错',
    'manim',
  ];
  if (directVideoKeywords.some((keyword) => text.includes(keyword))) return true;

  const frameKeywords = ['帧', '第几帧', '某一帧', '哪一帧', '卡住', '花屏', '抖动'];
  const fixKeywords = ['修', '修复', '改', '调整', '重做', '重生成', '重新生成', '重新渲染', '定位代码'];
  if (frameKeywords.some((keyword) => text.includes(keyword)) && fixKeywords.some((keyword) => text.includes(keyword))) {
    return true;
  }

  return hasImage && (text.includes('视频') || text.includes('帧')) && fixKeywords.some((keyword) => text.includes(keyword));
}

export function classifyVideoFollowUp(message: string): 'regenerate' | 'revise_previous' | undefined {
  const text = message.toLowerCase().replace(/\s+/g, '');
  const regenerateKeywords = ['重新生成', '重新生一个', '再生一个', '重做', '换一个版本', '重新渲染', '再试一次'];
  if (regenerateKeywords.some((keyword) => text.includes(keyword))) return 'regenerate';
  const reviseKeywords = ['改一下', '修改', '优化', '更详细', '讲慢点', '换种讲法', '不对', '有问题', '画面不对', '题目理解错'];
  if (reviseKeywords.some((keyword) => text.includes(keyword))) return 'revise_previous';
  return undefined;
}

function buildModelFacingSummary(params: {
  originalUserMessage: string;
  imageSemantic?: ImageSemanticOutput;
  previousVideoContent?: PreviousVideoContent;
  currentUserMessage?: string;
  qaAnswer?: string;
  mode: VideoContextResolution['mode'];
}): string {
  const sections = [
    ['[原始任务]', truncateForModel(params.originalUserMessage, ORIGINAL_TASK_MAX_CHARS)],
  ];
  if (params.imageSemantic) {
    sections.push([
      '[图片语义重建]',
      truncateForModel(formatImageSemantic(params.imageSemantic), IMAGE_SEMANTIC_MAX_CHARS),
    ]);
  }
  if (params.qaAnswer?.trim()) {
    sections.push(['[问答结论]', truncateForModel(params.qaAnswer, PREVIOUS_VIDEO_MAX_CHARS)]);
  }
  if (params.previousVideoContent) {
    sections.push([
      '[上一版视频内容摘要]',
      truncateForModel(formatPreviousVideoContent(params.previousVideoContent), PREVIOUS_VIDEO_MAX_CHARS),
    ]);
  }
  if (params.currentUserMessage?.trim()) {
    sections.push([
      '[本轮用户指令]',
      truncateForModel(params.currentUserMessage, USER_INSTRUCTION_MAX_CHARS),
    ]);
  }
  sections.push([
    '[生成要求]',
    [
      '- 必须基于原始任务和图片语义，不得自行更换题目',
      params.mode === 'new_video' ? '- 生成完整讲解视频' : '- 基于上一版文本摘要生成新的讲解版本',
      '- 如果本轮是修改，需优先满足本轮用户指令',
      '- 不得根据视频 URL、MP4 或归档地址分析上一版视频',
    ].join('\n'),
  ]);
  return truncateForModel(sections.map(([title, body]) => `${title}\n${body}`).join('\n\n'), MODEL_CONTEXT_MAX_CHARS);
}

function formatImageSemantic(imageSemantic: ImageSemanticOutput): string {
  return [
    `题干: ${imageSemantic.problemText}`,
    `图像描述: ${imageSemantic.visualDescription}`,
    `已知条件: ${imageSemantic.knownConditions.join('；')}`,
    `目标问题: ${imageSemantic.targetQuestion}`,
    `语义摘要: ${imageSemantic.semanticSummary}`,
  ].join('\n');
}

function formatPreviousVideoContent(content: PreviousVideoContent): string {
  return [
    content.storyboardSummary ? `分镜摘要: ${content.storyboardSummary}` : '',
    content.narrationSummary ? `旁白摘要: ${content.narrationSummary}` : '',
    content.visualPlanSummary ? `画面结构摘要: ${content.visualPlanSummary}` : '',
  ].filter(Boolean).join('\n');
}

async function readPreviousVideoContent(artifactRunDir: string): Promise<PreviousVideoContent | undefined> {
  try {
    const raw = await readFile(join(artifactRunDir, 'storyboard.json'), 'utf-8');
    const payload = JSON.parse(raw) as { scenes?: unknown[] };
    const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
    if (!scenes.length) return undefined;
    const records = scenes.map((scene, index) => {
      const item = scene as Record<string, unknown>;
      return {
        index: index + 1,
        title: String(item.title ?? ''),
        description: String(item.description ?? ''),
        animationNotes: String(item.animationNotes ?? item.animation_notes ?? ''),
        narration: String(item.narration ?? ''),
      };
    });
    return {
      storyboardSummary: truncateForModel(
        records.map((item) => `${item.index}. ${item.title}`).join('；'),
        1200,
      ),
      narrationSummary: truncateForModel(
        records.map((item) => item.narration).filter(Boolean).join('\n'),
        1400,
      ),
      visualPlanSummary: truncateForModel(
        records.map((item) => `${item.description}\n${item.animationNotes}`).filter(Boolean).join('\n'),
        1600,
      ),
    };
  } catch {
    return undefined;
  }
}

function truncateForModel(value: string, maxChars: number): string {
  const sanitized = stripForbiddenModelFields(value).replace(/\s+\n/g, '\n').trim();
  if (sanitized.length <= maxChars) return sanitized;
  return `${sanitized.slice(0, maxChars - 20)}\n[内容已截断]`;
}

function stripForbiddenModelFields(value: string): string {
  return value.replace(URL_PATTERN, '[系统引用已过滤]');
}
