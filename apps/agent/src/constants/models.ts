/**
 * 模型常量 — 集中管理模型标识符，便于统一升级
 *
 * 模型选用原则（见技术说明文档第九章）：
 *   - 意图分类、知识点提取、学情报告 → Haiku（成本低）
 *   - 核心问答、视频脚本 → Sonnet（高质量推理）
 *   - 复杂数学推导 → Sonnet + extended thinking
 */

export const MODELS = {
  /** 快速/廉价，用于分类、提取等简单任务 */
  HAIKU: 'claude-haiku-4-5',

  /** 核心推理，用于 QA 和视频脚本生成 */
  SONNET: 'claude-sonnet-4-5',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
