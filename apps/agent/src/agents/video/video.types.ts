export interface VideoAgentInput {
  knowledgeDescription: string;
  subject: string;
  /** 默认 true；传 false 强制重新渲染，跳过缓存 */
  useVideoCache?: boolean;
  /** 相似度阈值，默认 0.92 */
  cacheScoreThreshold?: number;
  /** 运行日志标识 */
  runId?: string;
  /** 运行目录绝对路径 */
  artifactRunDir?: string;
  /** 对象存储前缀 */
  artifactObjectPrefix?: string;
}

export interface VideoAgentOutput {
  videoUrl?: string;
  success: boolean;
  failureReason?: string;
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
}

export interface StoryboardScene {
  sceneIndex: number;
  title: string;
  layout: 'left_right' | 'center';
  description: string;
  animationNotes: string;
  narration: string;
  subtitles: string[];
  durationSeconds: number;
}

export interface VideoState {
  knowledgeDescription: string;
  subject: string;
  workflowId?: string;
  traceId?: string;
  useVideoCache: boolean;
  cacheScoreThreshold: number;
  /** 是否命中视频缓存 */
  cacheHit: boolean;
  /** 分镜脚本 */
  storyboard?: StoryboardScene[];
  /** 生成的 Manim Python 脚本 */
  manimScript?: string;
  /** Manim 渲染产物路径 */
  renderedVideoPath?: string;
  /** 当前重试次数 */
  retryCount: number;
  /** 上次渲染错误信息 */
  lastError?: string;
  /** 错误分类 */
  errorType?: 'syntax' | 'import' | 'name' | 'attribute' | 'latex' | 'timeout' | 'runtime' | 'unknown';
  /** 当前修复策略 */
  fixStrategy?: 'rule' | 'local_patch' | 'full_rewrite';
  /** 脚本版本号，每次修复成功递增 */
  scriptVersion: number;
  /** 修复历史，便于回溯与可观测 */
  fixHistory: Array<{
    attempt: number;
    strategy: 'rule' | 'local_patch' | 'full_rewrite';
    reason: string;
  }>;
  /** 脚本校验结果（失败时记录） */
  validationReport?: string;
  /** 最终视频 URL */
  videoUrl?: string;
  /** 是否成功 */
  success: boolean;
  failureReason?: string;
  /** 运行日志标识 */
  runId?: string;
  /** 运行目录绝对路径 */
  artifactRunDir?: string;
  /** 对象存储前缀 */
  artifactObjectPrefix?: string;
  /** 运行归档地址 */
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
}

export interface StoryboardRaw {
  scenes: Array<{
    scene_index: number;
    title: string;
    layout: 'left_right' | 'center';
    description: string;
    animation_notes: string;
    narration: string;
    subtitles: string[];
    duration_seconds: number;
  }>;
  total_duration_seconds: number;
}
