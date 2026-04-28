/**
 * 规则层常量 — 从 src/prompt/shared/*.rules.md 加载，集中维护规则文本
 * buildRulesSection() 将规则数组格式化为注入 Persona Prompt 的约束段落
 */

import { loadRules } from '../harness/prompt/loader.js';

export const GLOBAL_RULES          = loadRules('shared/global.rules.md');
export const QA_AGENT_RULES        = loadRules('shared/qa.rules.md');
export const VIDEO_AGENT_RULES     = loadRules('shared/video.rules.md');
export const LEARNING_RECORD_RULES = loadRules('shared/learning-record.rules.md');

export function buildRulesSection(rules: readonly string[]): string {
  return `## 规则约束\n\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
}
