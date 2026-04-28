/**
 * 模型常量 — 集中管理模型标识符，便于统一升级
 *
 * 模型选用原则（见技术说明文档第九章）：
 *   - 意图分类、知识点提取、学情报告 → FAST 模型（成本低）
 *   - 核心问答、视频脚本 → SMART 模型（高质量推理）
 *   - 复杂数学推导 → SMART 模型 + extended thinking（仅 Anthropic 支持）
 *
 * 切换 Provider 后（LLM_PROVIDER=doubao），请同时将 FAST/SMART 指向豆包对应模型。
 * 豆包模型 ID 可以是通用名（doubao-pro-32k）或火山引擎 Endpoint ID（ep-xxxxxxxx-xxxxx）。
 */

export const MODELS = {
  // ─── Anthropic Claude ────────────────────────────────────────────────────────
  /** 快速/廉价，用于分类、提取等简单任务 */
  HAIKU: 'claude-haiku-4-5',
  /** 核心推理，用于 QA 和视频脚本生成 */
  SONNET: 'claude-sonnet-4-5',

  // ─── 豆包（火山引擎 Ark）────────────────────────────────────────────────────
  /** 豆包 Lite：低延迟，适合意图分类、摘要等简单任务 */
  DOUBAO_LITE: 'doubao-lite-32k',
  /** 豆包 Pro：高性能，适合核心问答、内容生成 */
  DOUBAO_PRO: 'doubao-pro-32k',
  /** 豆包 Pro 128K：支持长文本上下文 */
  DOUBAO_PRO_128K: 'doubao-pro-128k',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
