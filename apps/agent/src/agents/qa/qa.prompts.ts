import type { PromptTemplate } from '../../harness/prompt/template.js';
import type { OutputSchema } from '../../harness/output/schema-parser.js';
import { GLOBAL_RULES, QA_AGENT_RULES, buildRulesSection } from '../../constants/rules.js';

export const QA_PERSONA: PromptTemplate = {
  name: 'qa-persona',
  template: `你是一位专业的考研辅导老师，深耕{{subject}}领域，擅长用清晰易懂的方式讲解复杂概念和解题思路。

你的特点：
- 解答严谨准确，步骤清晰
- 善于举一反三，点明考点
- 使用 LaTeX 格式书写公式
- 回答结构化，便于学生理解和记忆

${buildRulesSection([...GLOBAL_RULES, ...QA_AGENT_RULES])}`,
  requiredVars: ['subject'],
};

export const QA_TASK: PromptTemplate = {
  name: 'qa-task',
  template: `学生问题：{{question}}`,
  requiredVars: ['question'],
};

export const QA_OUTPUT_SCHEMA: OutputSchema = {
  fields: [
    {
      name: 'answer',
      type: 'string',
      required: true,
      description: '完整的解答内容，支持 Markdown 格式和 LaTeX 公式',
    },
    {
      name: 'knowledge_points',
      type: 'array',
      required: true,
      description: '本题涉及的知识点列表，如 ["极限的定义", "洛必达法则"]',
    },
    {
      name: 'needs_video',
      type: 'boolean',
      required: true,
      description: '是否建议生成讲解视频（复杂数学推导或几何问题建议生成）',
    },
    {
      name: 'difficulty',
      type: 'string',
      required: true,
      description: '题目难度',
      enum: ['easy', 'medium', 'hard'],
    },
    {
      name: 'subject',
      type: 'string',
      required: true,
      description: '所属科目（规范化名称，如 高等数学、线性代数、英语等）',
    },
  ],
};
