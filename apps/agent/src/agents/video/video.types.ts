export interface VideoAgentInput {
  knowledgeDescription: string;
  subject: string;
  /** 默认 true；传 false 强制重新渲染，跳过缓存 */
  useVideoCache?: boolean;
  /** 相似度阈值，默认 0.92 */
  cacheScoreThreshold?: number;
}

export interface VideoAgentOutput {
  videoUrl?: string;
  success: boolean;
  failureReason?: string;
}

export interface StoryboardScene {
  sceneIndex: number;
  description: string;
  animationNotes: string;
  narration: string;
  durationSeconds: number;
}

export interface VideoState {
  knowledgeDescription: string;
  subject: string;
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
}

export interface StoryboardRaw {
  scenes: StoryboardScene[];
  total_duration_seconds: number;
}

export interface ManimScriptRaw {
  script: string;
  scene_class_name: string;
}
