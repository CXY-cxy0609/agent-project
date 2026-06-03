<template>
  <a-modal
    :open="open"
    title="生成测试题"
    width="720px"
    :confirm-loading="generating"
    ok-text="开始生成"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="$emit('update:open', false)"
  >
    <a-form layout="vertical">
      <a-form-item label="学科">
        <a-select v-model:value="subjectId" allow-clear placeholder="不限定学科">
          <a-select-option v-for="subject in subjects" :key="subject.id" :value="subject.id">
            {{ subject.name }}
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item label="知识点">
        <a-select v-model:value="selectedKnowledge" mode="tags" placeholder="输入知识点，如：唯物辩证法" />
      </a-form-item>

      <a-form-item label="题型与题量">
        <div class="type-config-list">
          <div v-for="item in questionTypeConfigs" :key="item.type" class="type-config-row">
            <span>{{ questionTypeLabel(item.type) }}</span>
            <a-input-number v-model:value="item.count" :min="0" :max="20" />
          </div>
        </div>
        <div class="total-count">总题量：{{ totalQuestionCount }}</div>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="难度">
            <a-segmented v-model:value="difficulty" :options="difficultyOptions" block />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="练习模式">
            <a-segmented v-model:value="mode" :options="modeOptions" block />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';
import type { GenerateAssessmentRequest, QuestionType, UserSubject } from '@tutor/shared';

defineProps<{
  open: boolean;
  generating: boolean;
  subjects: UserSubject[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  generate: [request: GenerateAssessmentRequest];
}>();

const subjectId = ref<number | undefined>();
const selectedKnowledge = ref<string[]>([]);
const questionTypeConfigs = ref<Array<{ type: QuestionType; count: number }>>([
  { type: 'single_choice', count: 3 },
  { type: 'multiple_choice', count: 0 },
  { type: 'fill_blank', count: 1 },
  { type: 'true_false', count: 1 },
  { type: 'short_answer', count: 0 },
]);
const difficulty = ref('medium');
const mode = ref('quick_practice');

const totalQuestionCount = computed(() =>
  questionTypeConfigs.value.reduce((sum, item) => sum + Number(item.count || 0), 0),
);

const difficultyOptions = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
  { label: '混合', value: 'mixed' },
];

const modeOptions = [
  { label: '快速练习', value: 'quick_practice' },
  { label: '考试模式', value: 'exam' },
  { label: '查漏补缺', value: 'gap_check' },
];

function handleSubmit() {
  if (selectedKnowledge.value.length === 0) {
    message.warning('请至少输入一个知识点');
    return;
  }
  const typeConfigs = questionTypeConfigs.value.filter((item) => item.count > 0);
  if (typeConfigs.length === 0 || totalQuestionCount.value === 0) {
    message.warning('请至少设置一种题型的题量');
    return;
  }
  emit('generate', {
    subjectId: subjectId.value ?? null,
    source: 'manual',
    knowledgePoints: selectedKnowledge.value.map((label) => ({
      knowledgeKey: label,
      label,
      subjectId: subjectId.value ?? null,
    })),
    generationConfig: {
      mode: mode.value as GenerateAssessmentRequest['generationConfig']['mode'],
      difficulty: difficulty.value as GenerateAssessmentRequest['generationConfig']['difficulty'],
      questionTypes: typeConfigs,
      showExplanationPolicy: 'after_submit',
      timeLimitSeconds: null,
      knowledgeBasePolicy: 'prefer_authorized',
      style: 'concept_check',
    },
  });
}

function questionTypeLabel(type: string) {
  return {
    single_choice: '单选题',
    multiple_choice: '多选题',
    fill_blank: '填空题',
    true_false: '判断题',
    short_answer: '问答题',
  }[type] ?? type;
}
</script>

<style scoped lang="less">
.type-config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.total-count {
  margin-top: 8px;
  color: @color-text-muted;
  font-size: 12px;
}
</style>
