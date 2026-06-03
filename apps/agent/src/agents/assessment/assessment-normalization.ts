import type { QuestionType } from './assessment.types.js';

type AssessmentOption = { id: string; text: string };

export function normalizeAnswer(
  value: unknown,
  type: QuestionType,
  label: string,
  options?: AssessmentOption[],
): unknown {
  if (type === 'single_choice') return normalizeSingleChoiceAnswer(value, options);
  if (type === 'multiple_choice') return normalizeMultipleChoiceAnswer(value, options);
  if (type === 'fill_blank') return normalizeFillBlankAnswer(value, label);
  if (type === 'true_false') return normalizeTrueFalseAnswer(value);
  if (type === 'short_answer') return normalizeShortAnswer(value, label);
  return defaultAnswer(type, label);
}

function normalizeSingleChoiceAnswer(
  value: unknown,
  options?: AssessmentOption[],
): { type: 'single_choice'; correctOptionId: string } {
  if (isRecord(value)) {
    const correctOptionId = value.correctOptionId ?? value.optionId ?? value.id ?? value.value ?? value.answer;
    return { type: 'single_choice', correctOptionId: normalizeOptionId(correctOptionId, options) };
  }
  return { type: 'single_choice', correctOptionId: normalizeOptionId(value, options) };
}

function normalizeMultipleChoiceAnswer(
  value: unknown,
  options?: AssessmentOption[],
): { type: 'multiple_choice'; correctOptionIds: string[]; scoring: 'partial'; wrongOptionPenalty: true } {
  if (Array.isArray(value)) return buildMultipleChoiceAnswer(value.map((item) => normalizeOptionId(item, options)));
  if (isRecord(value)) {
    const rawIds = value.correctOptionIds ?? value.optionIds ?? value.ids ?? value.value ?? value.answer;
    return buildMultipleChoiceAnswer(normalizeOptionIds(rawIds, options));
  }
  return buildMultipleChoiceAnswer(normalizeOptionIds(value, options));
}

function buildMultipleChoiceAnswer(
  correctOptionIds: string[],
): { type: 'multiple_choice'; correctOptionIds: string[]; scoring: 'partial'; wrongOptionPenalty: true } {
  return {
    type: 'multiple_choice',
    correctOptionIds: correctOptionIds.length > 0 ? correctOptionIds : ['A', 'B'],
    scoring: 'partial',
    wrongOptionPenalty: true,
  };
}

function normalizeFillBlankAnswer(
  value: unknown,
  label: string,
): { type: 'fill_blank'; answers: Array<{ blankIndex: number; acceptedAnswers: string[]; caseSensitive: false }> } {
  if (isRecord(value) && Array.isArray(value.answers)) {
    return {
      type: 'fill_blank',
      answers: value.answers as Array<{ blankIndex: number; acceptedAnswers: string[]; caseSensitive: false }>,
    };
  }
  const acceptedAnswers = Array.isArray(value) ? value.map(String) : [String(value ?? label)];
  return { type: 'fill_blank', answers: [{ blankIndex: 1, acceptedAnswers, caseSensitive: false }] };
}

function normalizeTrueFalseAnswer(value: unknown): { type: 'true_false'; value: boolean } {
  if (isRecord(value)) return { type: 'true_false', value: parseBoolean(value.value ?? value.answer) };
  return { type: 'true_false', value: parseBoolean(value) };
}

function normalizeShortAnswer(value: unknown, label: string): { type: 'short_answer'; referenceAnswer: string } {
  if (isRecord(value)) {
    return {
      type: 'short_answer',
      referenceAnswer: String(value.referenceAnswer ?? value.answer ?? `围绕「${label}」展开说明。`),
    };
  }
  return { type: 'short_answer', referenceAnswer: String(value ?? `围绕「${label}」展开说明。`) };
}

function normalizeOptionIds(value: unknown, options?: AssessmentOption[]): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeOptionId(item, options));
  if (typeof value === 'string') {
    return value
      .split(/[,，、\s]+/)
      .map((item) => normalizeOptionId(item, options))
      .filter(Boolean);
  }
  return [];
}

function normalizeOptionId(value: unknown, options?: AssessmentOption[]): string {
  const raw = String(value ?? 'A').trim();
  const matched = options?.find((option) => option.id.toLowerCase() === raw.toLowerCase());
  if (matched) return matched.id;

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && options && numeric >= 0 && numeric < options.length) return options[numeric].id;

  return raw.toUpperCase();
}

function defaultAnswer(type: QuestionType, label: string): unknown {
  if (type === 'multiple_choice') {
    return { type, correctOptionIds: ['A', 'B'], scoring: 'partial', wrongOptionPenalty: true };
  }
  if (type === 'fill_blank') {
    return { type, answers: [{ blankIndex: 1, acceptedAnswers: [label], caseSensitive: false }] };
  }
  if (type === 'true_false') return { type, value: false };
  if (type === 'short_answer') return { type, referenceAnswer: `围绕「${label}」展开说明。` };
  return { type, correctOptionId: 'A' };
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '正确' || text === '对' || text === 'yes' || text === '1';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
