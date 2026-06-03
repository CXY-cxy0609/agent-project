import { BaseAgent } from '../../harness/core/agent.js';
import type { AgentContext, Message } from '../../harness/core/types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import { parseJsonObject } from '../assessment/json-utils.js';
import type { LearningSummaryInput, LearningSummaryOutput } from './learning-summary.types.js';

const SUMMARY_PROMPT_VERSION = 'learning-summary-v1';

export class LearningSummaryAgent extends BaseAgent<LearningSummaryInput, LearningSummaryOutput> {
  constructor(llm: LLMClient, observer: Observer, private readonly model: string) {
    super(llm, observer);
  }

  async execute(input: LearningSummaryInput, _ctx: AgentContext): Promise<LearningSummaryOutput> {
    const messages = buildStructuredMessages(input);
    const response = await this.llm.call({
      model: this.model,
      messages,
      systemPrompt:
        `你是学情分析 Agent。promptVersion=${SUMMARY_PROMPT_VERSION}。` +
        '你的任务是把结构化学习数据转成准确、可执行、非空泛的学情总结。',
      maxTokens: 1200,
      temperature: 0.2,
    });
    return normalizeSummary(parseJsonObject<Partial<LearningSummaryOutput>>(response.content));
  }

  async *stream(input: LearningSummaryInput, _ctx: AgentContext): AsyncGenerator<LearningSummaryStreamEvent> {
    const messages = buildNarrativeMessages(input);
    let content = '';
    yield { type: 'stage', stage: 'generating', message: '正在生成学情总结...' };
    for await (const chunk of this.llm.stream({
      model: this.model,
      messages,
      systemPrompt:
        `你是学情分析 Agent。promptVersion=${SUMMARY_PROMPT_VERSION}。` +
        '你的任务是把结构化学习数据转成准确、可执行、非空泛的学情总结。',
      maxTokens: 1400,
      temperature: 0.2,
    })) {
      if (chunk.type === 'text_delta' && chunk.delta) {
        content += chunk.delta;
        yield { type: 'delta', delta: chunk.delta };
      }
      if (chunk.type === 'done') {
        yield { type: 'final', output: summarizeNarrative(content) };
      }
    }
  }
}

type LearningSummaryStreamEvent =
  | { type: 'stage'; stage: 'generating'; message: string }
  | { type: 'delta'; delta: string }
  | { type: 'final'; output: LearningSummaryOutput };

function buildStructuredMessages(input: LearningSummaryInput): Message[] {
  return [{
    role: 'user',
    content:
      '请根据以下学习数据生成结构化学情总结。只基于输入数据，不要编造学习记录。\n' +
      '如果数据不足，请明确说明数据不足，并给出下一步建议。\n\n' +
      `数据：\n${JSON.stringify(input, null, 2)}\n\n` +
      '只输出 JSON，格式：{"summary":"...","highlights":["..."],"weakPointAnalysis":["..."],"recommendedActions":[{"type":"review|assessment|knowledge_base|subject_create","title":"...","reason":"...","knowledgeKey":"可选","subjectId":null}],"riskLevel":"low|medium|high"}',
  }];
}

function buildNarrativeMessages(input: LearningSummaryInput): Message[] {
  return [{
    role: 'user',
    content:
      '请根据以下学习数据生成一份可直接展示给学生的学情总结。只基于输入数据，不要编造学习记录。\n' +
      '要求使用 Markdown，包含以下小节：\n' +
      '1. ## 整体诊断：2-3 句话说明当前状态和风险。\n' +
      '2. ## 学习亮点：2-4 条具体亮点；数据不足时说明暂无可靠亮点。\n' +
      '3. ## 薄弱点分析：2-4 条，必须解释原因。\n' +
      '4. ## 下一步行动：3-5 条可执行建议。\n\n' +
      `数据：\n${JSON.stringify(input, null, 2)}`,
  }];
}

function normalizeSummary(output: Partial<LearningSummaryOutput>): LearningSummaryOutput {
  return {
    summary: String(output.summary ?? '暂无足够学习记录生成可靠学情总结。'),
    highlights: Array.isArray(output.highlights) ? output.highlights.map(String) : [],
    weakPointAnalysis: Array.isArray(output.weakPointAnalysis) ? output.weakPointAnalysis.map(String) : [],
    recommendedActions: Array.isArray(output.recommendedActions)
      ? output.recommendedActions.map((item) => ({
          type: item.type,
          title: String(item.title ?? ''),
          reason: String(item.reason ?? ''),
          knowledgeKey: item.knowledgeKey,
          subjectId: item.subjectId,
        })).filter((item) => item.title && item.reason)
      : [],
    riskLevel: output.riskLevel === 'high' || output.riskLevel === 'medium' ? output.riskLevel : 'low',
  };
}

function summarizeNarrative(content: string): LearningSummaryOutput {
  const text = content.trim() || '暂无足够学习记录生成可靠学情总结。';
  const highlights = extractSectionList(text, '学习亮点');
  const weakPointAnalysis = extractSectionList(text, '薄弱点分析');
  const actions = extractSectionList(text, '下一步行动').map((item) => ({
    type: inferActionType(item),
    title: trimListMarker(item).slice(0, 36),
    reason: trimListMarker(item),
  }));
  return {
    summary: text,
    highlights,
    weakPointAnalysis,
    recommendedActions: actions,
    riskLevel: inferRiskLevel(text),
  };
}

function extractSectionList(text: string, title: string): string[] {
  const section = extractSection(text, title);
  return section
    .split('\n')
    .map(trimListMarker)
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .slice(0, 5);
}

function extractSection(text: string, title: string): string {
  const start = text.search(new RegExp(`^##\\s*${title}`, 'm'));
  if (start < 0) return '';
  const rest = text.slice(start).split('\n').slice(1).join('\n');
  const next = rest.search(/^##\s+/m);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function trimListMarker(line: string): string {
  return line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+[.)、]\s*/, '').trim();
}

function inferActionType(text: string): LearningSummaryOutput['recommendedActions'][number]['type'] {
  if (/测|练|题|训练/.test(text)) return 'assessment';
  if (/知识库|资料|笔记/.test(text)) return 'knowledge_base';
  if (/学科|大纲/.test(text)) return 'subject_create';
  return 'review';
}

function inferRiskLevel(text: string): LearningSummaryOutput['riskLevel'] {
  if (/高危|严重|明显不足|风险较高|大量/.test(text)) return 'high';
  if (/需注意|中等|波动|不足|薄弱/.test(text)) return 'medium';
  return 'low';
}
