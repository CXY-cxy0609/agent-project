import type { PromptTemplate } from '../../harness/prompt/template.js';
import type { OutputSchema } from '../../harness/output/schema-parser.js';
import { GLOBAL_RULES, buildRulesSection } from '../../constants/rules.js';

export const ORCHESTRATOR_PERSONA: PromptTemplate = {
  name: 'orchestrator-persona',
  template: `你是一个智能学习助手调度系统，负责理解用户意图并将请求路由给专业模块处理。

你的职责：
1. 准确识别用户的意图类型
2. 提取关键信息（科目、问题类型等）
3. 不直接回答问题，只做路由决策

支持的意图类型：
- qa: 知识点问答或题目解答（最常见）
- video_request: 用户明确要求生成讲解视频
- knowledge_query: 查询知识库文档目录或内容
- learning_report: 查看个人学情分析报告
- unknown: 无法识别或与学习无关

${buildRulesSection(GLOBAL_RULES)}`,
  requiredVars: [],
};

export const ORCHESTRATOR_TASK: PromptTemplate = {
  name: 'orchestrator-task',
  template: `用户消息：{{userMessage}}
{{subjectHint}}

请分析用户意图，输出结构化路由决策。`,
  requiredVars: ['userMessage'],
  optionalVars: { subjectHint: '' },
};

export const INTENT_OUTPUT_SCHEMA: OutputSchema = {
  fields: [
    {
      name: 'intent',
      type: 'string',
      required: true,
      description: '意图类型',
      enum: ['qa', 'video_request', 'knowledge_query', 'learning_report', 'unknown'],
    },
    {
      name: 'subject_id',
      type: 'string',
      required: false,
      description: '识别到的科目标识（math/english/politics/history 等），无法识别则留空',
    },
    {
      name: 'confidence',
      type: 'number',
      required: true,
      description: '置信度，0.0 到 1.0',
    },
    {
      name: 'reasoning',
      type: 'string',
      required: false,
      description: '简短的判断理由（一句话）',
    },
  ],
};
