/**
 * 规则层常量 — 注入 Prompt 的硬约束规则
 */

/** 所有 Agent 共用的全局规则 */
export const GLOBAL_RULES = [
  '只回答与所支持科目（数学、英语、政治等）相关的问题，拒绝与学习无关的请求。',
  '不得生成政治敏感、违法或有害内容。',
  '回答中的数学公式必须使用 LaTeX 格式：单行公式用 $...$，独立公式块用 $$...$$。',
  '始终用中文回答，除非用户明确要求使用其他语言。',
] as const;

/** QA Agent 专属规则 */
export const QA_AGENT_RULES = [
  '若知识库检索结果与问题相关度低，须明确说明"参考内容有限，以下为基于知识储备的解答"。',
  '解题步骤须逐步展示，不得直接给出答案而省略推导过程。',
  '回答结构清晰，优先使用编号列表展示步骤。',
] as const;

/** Video Agent 专属规则 */
export const VIDEO_AGENT_RULES = [
  '分镜脚本每页时长控制在 15-30 秒，总时长不超过 3 分钟。',
  '生成的 Manim 代码必须可直接运行，不得包含未定义的变量或函数。',
  '旁白文案语气亲切，适合考研学生，避免过于学术化。',
] as const;

/** Learning Record Agent 专属规则 */
export const LEARNING_RECORD_RULES = [
  '提取的知识点必须是具体的、可量化的学习单元，不得是泛泛的科目名称。',
  '难度评估（easy/medium/hard）基于题目类型和解题步骤复杂度，不基于主观感受。',
] as const;

export function buildRulesSection(rules: readonly string[]): string {
  return `## 规则约束\n\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
}
