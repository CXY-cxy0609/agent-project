import { randomUUID } from 'crypto';
import { BaseAgent } from '../../harness/core/agent.js';
import type { AgentContext, ContentBlock, Message } from '../../harness/core/types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import { parseJsonObject } from './json-utils.js';
import { normalizeAnswer } from './assessment-normalization.js';
import type {
  AssessmentKnowledgePoint,
  AssessmentQuestion,
  GenerateAssessmentInput,
  GenerateAssessmentOutput,
  GradeAssessmentInput,
  GradeAssessmentOutput,
  QuestionType,
} from './assessment.types.js';

const PROMPT_VERSION = 'assessment-v1';

export class AssessmentAgent extends BaseAgent<
  GenerateAssessmentInput | GradeAssessmentInput,
  GenerateAssessmentOutput | GradeAssessmentOutput
> {
  constructor(llm: LLMClient, observer: Observer, private readonly model: string) {
    super(llm, observer);
  }

  async execute(
    input: GenerateAssessmentInput | GradeAssessmentInput,
    ctx: AgentContext,
  ): Promise<GenerateAssessmentOutput | GradeAssessmentOutput> {
    if ('questions' in input) return this.grade(input, ctx);
    return this.generate(input, ctx);
  }

  private async generate(input: GenerateAssessmentInput, _ctx: AgentContext): Promise<GenerateAssessmentOutput> {
    const response = await this.llm.call({
      model: this.model,
      messages: [{
        role: 'user',
        content:
          '请根据配置生成测试题。必须严格满足每种题型 count，不要多题或少题。\n' +
          '只输出 JSON，格式：{"questions":[...]}，不要输出 Markdown 或解释文字。\n' +
          '每题必须包含字段：knowledgeKey, questionType, stem, options, answer, rubric, difficulty, score, explanation。\n' +
          '题型包括 single_choice, multiple_choice, fill_blank, true_false, short_answer。\n' +
          '选择题 options 必须是对象数组，不允许字符串数组：' +
          '[{"id":"A","text":"选项内容"},{"id":"B","text":"选项内容"},{"id":"C","text":"选项内容"},{"id":"D","text":"选项内容"}]。\n' +
          'single_choice 的 answer 必须是 {"type":"single_choice","correctOptionId":"A"}，correctOptionId 必须来自 options[].id。\n' +
          'multiple_choice 的 answer 必须是 {"type":"multiple_choice","correctOptionIds":["A","B"],"scoring":"partial","wrongOptionPenalty":true}，至少 2 个正确选项，且全部来自 options[].id。\n' +
          'fill_blank 的 answer 必须是 {"type":"fill_blank","answers":[{"blankIndex":1,"acceptedAnswers":["答案"],"caseSensitive":false}]}。\n' +
          'true_false 的 answer 必须是 {"type":"true_false","value":true} 或 {"type":"true_false","value":false}。\n' +
          'short_answer 的 answer 必须是 {"type":"short_answer","referenceAnswer":"参考答案"}，且必须提供 rubric 数组。\n' +
          '禁止把 answer 写成字符串、布尔值、数组或数字下标；禁止使用 "0","1","2" 表示选项。\n\n' +
          JSON.stringify(input, null, 2),
      }],
      systemPrompt: `你是测试题生成 Agent。promptVersion=${PROMPT_VERSION}。必须严格遵守用户消息中的 JSON Schema 约束。`,
      maxTokens: 4000,
      temperature: 0.3,
    });
    const parsed = parseJsonObject<{ questions?: Partial<AssessmentQuestion>[] }>(response.content);
    const questions = normalizeGeneratedQuestions(parsed.questions ?? [], input);
    validateGeneratedQuestionCounts(questions, input);
    validateQuestionQuality(questions);
    return {
      questions,
      metadata: { generatedBy: 'agent', promptVersion: PROMPT_VERSION, model: this.model },
    };
  }

  private async grade(input: GradeAssessmentInput, _ctx: AgentContext): Promise<GradeAssessmentOutput> {
    const deterministic = input.questions.map((question) => {
      const userAnswer = input.answers.find((item) => item.questionId === question.id);
      return gradeQuestion(question, userAnswer?.answer);
    });
    const messages = buildGradingMessages(input, deterministic);
    const response = await this.llm.call({
      model: this.model,
      messages,
      systemPrompt:
        `你是测试题批改 Agent。promptVersion=${PROMPT_VERSION}。` +
        '你必须输出结构化 JSON。客观题参考 deterministicGrades，问答题按 rubric 和图片理解进行批改。',
      maxTokens: 4000,
      temperature: 0.1,
    });
    const parsed = parseJsonObject<Partial<GradeAssessmentOutput>>(response.content);
    return normalizeGradeOutput(parsed, deterministic);
  }

  private buildQuestion(
    questionType: QuestionType,
    point: AssessmentKnowledgePoint,
    difficulty: string,
    index: number,
  ): AssessmentQuestion {
    const base = {
      id: `q_${randomUUID()}`,
      knowledgeKey: point.knowledgeKey || point.label,
      questionType,
      difficulty: normalizeDifficulty(difficulty),
      score: questionType === 'short_answer' ? 10 : 5,
      explanation: `本题考查「${point.label}」的核心理解。`,
    } as const;

    if (questionType === 'single_choice') {
      return {
        ...base,
        stem: `关于「${point.label}」，下列哪一项表述最准确？`,
        options: defaultOptions(point.label),
        answer: { type: 'single_choice', correctOptionId: 'A' },
      };
    }
    if (questionType === 'multiple_choice') {
      return {
        ...base,
        stem: `关于「${point.label}」，下列哪些说法是正确的？`,
        options: defaultOptions(point.label),
        answer: {
          type: 'multiple_choice',
          correctOptionIds: ['A', 'B'],
          scoring: 'partial',
          wrongOptionPenalty: true,
        },
      };
    }
    if (questionType === 'true_false') {
      return {
        ...base,
        stem: `判断：学习「${point.label}」时，只需要记住名称，不需要理解适用条件。`,
        answer: { type: 'true_false', value: false },
      };
    }
    if (questionType === 'fill_blank') {
      return {
        ...base,
        stem: `填空：本题考查的核心知识点是____。`,
        answer: {
          type: 'fill_blank',
          answers: [{ blankIndex: 1, acceptedAnswers: [point.label], caseSensitive: false }],
        },
      };
    }
    return {
      ...base,
      stem: `请简要说明「${point.label}」的核心含义和典型应用。`,
      answer: {
        type: 'short_answer',
        referenceAnswer: `应围绕「${point.label}」的概念、适用条件和应用场景展开说明。`,
      },
      rubric: [
        { criterion: '说明核心概念', points: 4 },
        { criterion: '解释适用条件', points: 3 },
        { criterion: '表达清晰', points: 3 },
      ],
      explanation: `可从概念、条件和应用三个角度回答「${point.label}」。`,
    };
  }
}

function normalizeGeneratedQuestions(
  rawQuestions: Partial<AssessmentQuestion>[],
  input: GenerateAssessmentInput,
): AssessmentQuestion[] {
  return rawQuestions.map((question, index) => {
    const point = input.knowledgePoints[index % input.knowledgePoints.length];
    const questionType = normalizeQuestionType(question.questionType);
    const options = normalizeOptions(question.options);
    return {
      id: question.id?.startsWith('q_') ? question.id : `q_${randomUUID()}`,
      knowledgeKey: String(question.knowledgeKey ?? point.knowledgeKey ?? point.label),
      questionType,
      stem: String(question.stem ?? ''),
      options,
      answer: normalizeAnswer(question.answer, questionType, point.label, options),
      rubric: normalizeRubric(question.rubric),
      difficulty: normalizeDifficulty(String(question.difficulty ?? input.generationConfig.difficulty)),
      score: Number(question.score ?? (questionType === 'short_answer' ? 10 : 5)),
      explanation: String(question.explanation ?? ''),
    };
  });
}

function validateGeneratedQuestionCounts(questions: AssessmentQuestion[], input: GenerateAssessmentInput): void {
  for (const cfg of input.generationConfig.questionTypes) {
    const actual = questions.filter((question) => question.questionType === cfg.type).length;
    if (actual !== cfg.count) {
      throw new Error(`question count mismatch for ${cfg.type}: expected ${cfg.count}, got ${actual}`);
    }
  }
}

function buildGradingMessages(
  input: GradeAssessmentInput,
  deterministicGrades: ReturnType<typeof gradeQuestion>[],
): Message[] {
  const text =
    '请批改以下测试答案，输出 JSON：{"totalScore":number,"maxScore":number,"answers":[{"questionId":"...","isCorrect":boolean,"score":number,"maxScore":number,"scoreRatio":number,"feedback":"...","rubricScores":[...]}],"recommendations":["..."]}\n' +
    JSON.stringify({ ...input, deterministicGrades }, null, 2);
  const blocks: ContentBlock[] = [{ type: 'text', text }];
  for (const answer of input.answers) {
    for (const attachment of answer.attachments ?? []) {
      if (attachment.url) blocks.push({ type: 'image', source: { type: 'url', url: attachment.url } });
    }
  }
  return [{ role: 'user', content: blocks }];
}

function normalizeQuestionType(value: unknown): QuestionType {
  const text = String(value ?? '');
  if (
    text === 'single_choice' ||
    text === 'multiple_choice' ||
    text === 'fill_blank' ||
    text === 'true_false' ||
    text === 'short_answer'
  ) {
    return text;
  }
  return 'single_choice';
}

function normalizeOptions(value: unknown): Array<{ id: string; text: string }> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item, index) => normalizeOption(item, index))
    .filter((item) => item.text);
}

function normalizeOption(item: unknown, index: number): { id: string; text: string } {
  const fallbackId = String.fromCharCode(65 + index);
  if (typeof item === 'string') {
    return { id: fallbackId, text: item };
  }
  if (typeof item !== 'object' || item === null) {
    return { id: fallbackId, text: '' };
  }
  const record = item as Record<string, unknown>;
  return {
    id: String(record.id ?? record.optionId ?? record.value ?? record.label ?? fallbackId),
    text: String(record.text ?? record.content ?? record.optionText ?? record.label ?? ''),
  };
}

function normalizeRubric(value: unknown): Array<{ criterion: string; points: number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const rubric = value
    .map((item) => ({
      criterion: String((item as { criterion?: unknown })?.criterion ?? ''),
      points: Number((item as { points?: unknown })?.points ?? 0),
    }))
    .filter((item) => item.criterion && item.points > 0);
  return rubric.length ? rubric : undefined;
}

function validateQuestionQuality(questions: AssessmentQuestion[]): void {
  for (const question of questions) {
    if (!question.stem.trim()) {
      throw new Error(`assessment quality gate failed: empty stem for ${question.id}`);
    }
    if (question.questionType === 'single_choice' || question.questionType === 'multiple_choice') {
      validateObjectiveQuestion(question);
    }
  }
}

function validateObjectiveQuestion(question: AssessmentQuestion): void {
  const options = question.options ?? [];
  if (options.length < 2) {
    throw new Error(`assessment quality gate failed: missing options for ${question.id}`);
  }
  const optionIds = new Set(options.map((item) => item.id));
  const answer = question.answer as Record<string, unknown>;
  if (question.questionType === 'single_choice') {
    const correct = String(answer.correctOptionId ?? '');
    if (!optionIds.has(correct)) {
      throw new Error(`assessment quality gate failed: answer option missing for ${question.id}`);
    }
  }
  if (question.questionType === 'multiple_choice') {
    const correct = Array.isArray(answer.correctOptionIds) ? answer.correctOptionIds.map(String) : [];
    if (correct.length < 2 || correct.some((id) => !optionIds.has(id))) {
      throw new Error(`assessment quality gate failed: multiple choice answer invalid for ${question.id}`);
    }
  }
}

function normalizeGradeOutput(
  output: Partial<GradeAssessmentOutput>,
  fallback: ReturnType<typeof gradeQuestion>[],
): GradeAssessmentOutput {
  const answers = Array.isArray(output.answers) && output.answers.length > 0
    ? output.answers.map((item, index) => ({
        questionId: String(item.questionId ?? fallback[index]?.questionId ?? ''),
        isCorrect: Boolean(item.isCorrect),
        score: Number(item.score ?? 0),
        maxScore: Number(item.maxScore ?? fallback[index]?.maxScore ?? 0),
        scoreRatio: Number(item.scoreRatio ?? 0),
        feedback: String(item.feedback ?? ''),
        rubricScores: Array.isArray(item.rubricScores) ? item.rubricScores : undefined,
      }))
    : fallback;
  const totalScore = Number(output.totalScore ?? answers.reduce((sum, item) => sum + item.score, 0));
  const maxScore = Number(output.maxScore ?? answers.reduce((sum, item) => sum + item.maxScore, 0));
  return {
    totalScore: round2(totalScore),
    maxScore: round2(maxScore),
    answers,
    recommendations: Array.isArray(output.recommendations)
      ? output.recommendations.map(String)
      : buildRecommendations(answers),
  };
}

function defaultOptions(label: string): Array<{ id: string; text: string }> {
  return [
    { id: 'A', text: `能够准确解释「${label}」的核心含义` },
    { id: 'B', text: `能够说明「${label}」的适用条件` },
    { id: 'C', text: '只需要背诵名称即可' },
    { id: 'D', text: '与当前知识点没有关系' },
  ];
}

function gradeQuestion(question: AssessmentQuestion, answer: unknown) {
  const maxScore = Number(question.score || 0);
  const standard = question.answer as Record<string, unknown>;
  if (question.questionType === 'multiple_choice') {
    return gradeMultipleChoice(question.id, maxScore, standard, answer);
  }
  if (question.questionType === 'single_choice') {
    const correct = String(standard.correctOptionId ?? '') === String(answer ?? '');
    return gradeBinary(question.id, correct, maxScore);
  }
  if (question.questionType === 'true_false') {
    const correct = Boolean(standard.value) === Boolean(answer);
    return gradeBinary(question.id, correct, maxScore);
  }
  if (question.questionType === 'fill_blank') {
    const accepted = extractAcceptedAnswers(standard);
    const correct = accepted.includes(String(answer ?? '').trim());
    return gradeBinary(question.id, correct, maxScore);
  }
  const text = String(answer ?? '').trim();
  const ratio = text.length >= 20 ? 0.8 : text.length > 0 ? 0.4 : 0;
  return {
    questionId: question.id,
    isCorrect: ratio >= 0.8,
    score: round2(maxScore * ratio),
    maxScore,
    scoreRatio: ratio,
    feedback: ratio >= 0.8 ? '回答较完整。' : '回答不够完整，请补充概念、条件和应用。',
    rubricScores: question.rubric?.map((item) => ({
      criterion: item.criterion,
      score: round2(item.points * ratio),
      maxScore: item.points,
      comment: ratio >= 0.8 ? '基本达成' : '需要补充',
    })),
  };
}

function gradeMultipleChoice(questionId: string, maxScore: number, standard: Record<string, unknown>, answer: unknown) {
  const correct = new Set((Array.isArray(standard.correctOptionIds) ? standard.correctOptionIds : []).map(String));
  const selected = new Set((Array.isArray(answer) ? answer : []).map(String));
  const correctSelected = [...selected].filter((id) => correct.has(id)).length;
  const wrongSelected = [...selected].filter((id) => !correct.has(id)).length;
  const base = correct.size > 0 ? correctSelected / correct.size : 0;
  const penalty = wrongSelected * 0.25;
  const ratio = Math.max(base - penalty, 0);
  return {
    questionId,
    isCorrect: ratio >= 0.999,
    score: round2(maxScore * ratio),
    maxScore,
    scoreRatio: round2(ratio),
    feedback: ratio >= 0.999 ? '多选题答案完全正确。' : '多选题存在漏选或错选。',
  };
}

function gradeBinary(questionId: string, correct: boolean, maxScore: number) {
  return {
    questionId,
    isCorrect: correct,
    score: correct ? maxScore : 0,
    maxScore,
    scoreRatio: correct ? 1 : 0,
    feedback: correct ? '答案正确。' : '答案不正确，请回顾相关知识点。',
  };
}

function extractAcceptedAnswers(answer: Record<string, unknown>): string[] {
  const answers = Array.isArray(answer.answers) ? answer.answers : [];
  return answers.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const accepted = (item as { acceptedAnswers?: unknown }).acceptedAnswers;
    return Array.isArray(accepted) ? accepted.map((value) => String(value).trim()) : [];
  });
}

function normalizeDifficulty(value: string): 'easy' | 'medium' | 'hard' {
  return value === 'easy' || value === 'hard' ? value : 'medium';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildRecommendations(results: Array<{ isCorrect: boolean }>): string[] {
  const wrongCount = results.filter((item) => !item.isCorrect).length;
  if (wrongCount === 0) return ['本次测试表现较好，可以继续提高题目难度。'];
  return [`本次有 ${wrongCount} 道题需要复盘，建议针对错题知识点再练一组。`];
}
