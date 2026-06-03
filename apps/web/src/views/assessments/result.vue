<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ assessment?.title || '批改结果' }}</h1>
        <p class="page-desc">查看得分、反馈和标准答案</p>
      </div>
      <a-button @click="router.push('/app/assessments')">返回列表</a-button>
    </div>

    <a-spin :spinning="loading">
      <a-card class="summary-card">
        <a-statistic title="总分" :value="assessment?.totalScore ?? 0" :suffix="`/ ${assessment?.maxScore ?? '-'}`" />
      </a-card>

      <div class="question-list">
        <assessment-question-card
          v-for="(question, index) in assessment?.questions ?? []"
          :key="question.id"
          :question="question"
          :index="index"
          :model-value="answerMap[question.id]"
          :feedback="feedbackMap[question.id]"
          readonly
        />
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { assessmentsApi } from '@/api/assessments';
import AssessmentQuestionCard from '@/components/assessments/AssessmentQuestionCard.vue';
import type { Assessment, AssessmentAnswerResult } from '@tutor/shared';

const route = useRoute();
const router = useRouter();
const assessment = ref<Assessment | null>(null);
const loading = ref(false);

const answerMap = computed(() => {
  const result: Record<string, unknown> = {};
  for (const item of assessment.value?.answers ?? []) {
    result[item.questionId] = item.answer;
  }
  return result;
});

const feedbackMap = computed(() => {
  const result: Record<string, AssessmentAnswerResult> = {};
  for (const item of assessment.value?.gradeResults ?? []) {
    result[item.questionId] = item;
  }
  return result;
});

async function loadAssessment() {
  const assessmentId = String(route.params.assessmentId ?? '');
  if (!assessmentId || assessmentId === 'undefined' || assessmentId === 'null') {
    router.push('/app/assessments');
    return;
  }
  loading.value = true;
  try {
    assessment.value = await assessmentsApi.detail(assessmentId);
  } finally {
    loading.value = false;
  }
}

onMounted(loadAssessment);
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.page-title {
  font-family: @font-serif;
  font-size: 24px;
  font-weight: 700;
  color: @color-text-primary;
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: @color-text-muted;
  margin: 4px 0 0;
}

.summary-card {
  margin-bottom: 16px;
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
