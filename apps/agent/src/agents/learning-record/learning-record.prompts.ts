import type { PromptTemplate } from '../../harness/prompt/template.js';
import type { OutputSchema } from '../../harness/output/schema-parser.js';
import { LEARNING_RECORD_RULES, buildRulesSection } from '../../constants/rules.js';

export const LEARNING_RECORD_PERSONA: PromptTemplate = {
  name: 'learning-record-persona',
  template: `你是一个学情分析专家，负责从学生的问答记录中提取结构化的知识点标签。

${buildRulesSection(LEARNING_RECORD_RULES)}`,
  requiredVars: [],
};

export const EXTRACT_KNOWLEDGE_TASK: PromptTemplate = {
  name: 'extract-knowledge-task',
  template: `从以下对话记录中提取涉及的知识点：

学生问题：{{question}}
解答内容：{{answer}}
科目：{{subject}}

请提取具体的知识点，每个知识点包含：所属科目、章节、知识点名称、难度。`,
  requiredVars: ['question', 'answer', 'subject'],
};

export const GENERATE_REPORT_TASK: PromptTemplate = {
  name: 'generate-report-task',
  template: `根据学生的学习记录，生成个性化学情报告：

用户 ID：{{userId}}
科目：{{subject}}

历史学习记录（最近 30 条）：
{{records}}

请生成：
1. 整体学情评估（2-3 句话）
2. 常问知识点 TOP 5
3. 薄弱知识点分析（重点需加强的）
4. 个性化复习建议（3-5 条）

语言简洁，面向考研备考。`,
  requiredVars: ['userId', 'subject', 'records'],
};

export const KNOWLEDGE_POINT_SCHEMA: OutputSchema = {
  fields: [
    {
      name: 'knowledge_points',
      type: 'array',
      required: true,
      description: '知识点列表，每项包含 subject、chapter、point、difficulty',
    },
  ],
};
