<template>
  <a-card size="small" class="question-card">
    <template #title>{{ index + 1 }}. {{ questionTypeLabel(question.questionType) }}</template>
    <p class="question-stem">{{ question.stem }}</p>

    <a-alert
      v-if="isObjective && !question.options?.length"
      type="error"
      message="题目选项生成异常，请重新生成"
      show-icon
    />

    <a-radio-group
      v-else-if="question.questionType === 'single_choice'"
      :value="modelValue"
      :disabled="readonly"
      @update:value="$emit('update:modelValue', $event)"
    >
      <a-space direction="vertical">
        <a-radio v-for="option in question.options" :key="option.id" :value="option.id">
          {{ option.id }}. {{ option.text }}
        </a-radio>
      </a-space>
    </a-radio-group>

    <a-checkbox-group
      v-else-if="question.questionType === 'multiple_choice'"
      :value="Array.isArray(modelValue) ? modelValue : []"
      :disabled="readonly"
      @update:value="$emit('update:modelValue', $event)"
    >
      <a-space direction="vertical">
        <a-checkbox v-for="option in question.options" :key="option.id" :value="option.id">
          {{ option.id }}. {{ option.text }}
        </a-checkbox>
      </a-space>
    </a-checkbox-group>

    <a-radio-group
      v-else-if="question.questionType === 'true_false'"
      :value="modelValue"
      :disabled="readonly"
      @update:value="$emit('update:modelValue', $event)"
    >
      <a-radio :value="true">正确</a-radio>
      <a-radio :value="false">错误</a-radio>
    </a-radio-group>

    <a-input
      v-else-if="question.questionType === 'fill_blank'"
      :value="String(modelValue ?? '')"
      :disabled="readonly"
      placeholder="请输入答案"
      @update:value="$emit('update:modelValue', $event)"
    />

    <a-textarea
      v-else
      :value="String(modelValue ?? '')"
      :disabled="readonly"
      placeholder="请输入作答内容"
      :rows="4"
      @update:value="$emit('update:modelValue', $event)"
    />

    <a-alert
      v-if="feedback"
      class="question-feedback"
      :type="feedback.isCorrect ? 'success' : 'warning'"
      :message="feedback.feedback"
      show-icon
    />

    <div v-if="readonly && referenceAnswer" class="reference-answer">
      <div class="reference-title">参考答案</div>
      <div class="reference-content">{{ referenceAnswer }}</div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AssessmentAnswerResult, AssessmentQuestion } from '@tutor/shared';

const props = defineProps<{
  question: AssessmentQuestion;
  index: number;
  modelValue?: unknown;
  readonly?: boolean;
  feedback?: AssessmentAnswerResult;
}>();

defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const isObjective = computed(() =>
  props.question.questionType === 'single_choice' || props.question.questionType === 'multiple_choice',
);
const referenceAnswer = computed(() => formatReferenceAnswer(props.question));

function questionTypeLabel(type: string) {
  return {
    single_choice: '单选题',
    multiple_choice: '多选题',
    fill_blank: '填空题',
    true_false: '判断题',
    short_answer: '问答题',
  }[type] ?? type;
}

function formatReferenceAnswer(question: AssessmentQuestion): string {
  const answer = question.answer as Record<string, unknown>;
  if (question.questionType === 'single_choice') {
    return formatOptionAnswer(question, [String(answer.correctOptionId ?? '')]);
  }
  if (question.questionType === 'multiple_choice') {
    const ids = Array.isArray(answer.correctOptionIds) ? answer.correctOptionIds.map(String) : [];
    return formatOptionAnswer(question, ids);
  }
  if (question.questionType === 'true_false') {
    return Boolean(answer.value) ? '正确' : '错误';
  }
  if (question.questionType === 'fill_blank') {
    const answers = Array.isArray(answer.answers) ? answer.answers : [];
    return answers
      .flatMap((item) => {
        const acceptedAnswers = (item as { acceptedAnswers?: unknown }).acceptedAnswers;
        return Array.isArray(acceptedAnswers) ? acceptedAnswers.map(String) : [];
      })
      .join(' / ');
  }
  return String(answer.referenceAnswer ?? '');
}

function formatOptionAnswer(question: AssessmentQuestion, ids: string[]): string {
  return ids
    .filter(Boolean)
    .map((id) => {
      const option = question.options?.find((item) => item.id === id);
      return option ? `${id}. ${option.text}` : id;
    })
    .join('；');
}
</script>

<style scoped lang="less">
.question-card {
  border-radius: 12px;
}

.question-stem {
  margin-bottom: 12px;
  color: @color-text-primary;
}

.question-feedback {
  margin-top: 12px;
}

.reference-answer {
  margin-top: 12px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(42, 82, 152, 0.06);
  color: @color-text-secondary;
}

.reference-title {
  margin-bottom: 6px;
  font-weight: 600;
  color: @color-text-primary;
}

.reference-content {
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
