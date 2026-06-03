<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ assessment?.title || '测试作答' }}</h1>
        <p class="page-desc">{{ assessment?.statusLabel || '待作答' }} · {{ assessment?.questionCount ?? 0 }} 题</p>
      </div>
      <a-space>
        <a-button @click="router.push('/app/assessments')">返回列表</a-button>
        <a-button type="primary" :loading="submitting" @click="submitAssessment">提交答案</a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <div class="question-list">
        <assessment-question-card
          v-for="(question, index) in assessment?.questions ?? []"
          :key="question.id"
          v-model="answers[question.id]"
          :question="question"
          :index="index"
        />
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { assessmentsApi } from '@/api/assessments';
import AssessmentQuestionCard from '@/components/assessments/AssessmentQuestionCard.vue';
import type { Assessment } from '@tutor/shared';

const route = useRoute();
const router = useRouter();
const assessment = ref<Assessment | null>(null);
const answers = ref<Record<string, unknown>>({});
const loading = ref(false);
const submitting = ref(false);

async function loadAssessment() {
  const assessmentId = String(route.params.assessmentId ?? '');
  if (!assessmentId || assessmentId === 'undefined' || assessmentId === 'null') {
    message.error('测试记录不存在');
    router.push('/app/assessments');
    return;
  }
  loading.value = true;
  try {
    assessment.value = await assessmentsApi.detail(assessmentId);
    answers.value = {};
    for (const item of assessment.value.answers ?? []) {
      answers.value[item.questionId] = item.answer;
    }
  } finally {
    loading.value = false;
  }
}

async function submitAssessment() {
  if (!assessment.value) return;
  submitting.value = true;
  try {
    await assessmentsApi.submit({
      assessmentId: assessment.value.id,
      answers: Object.entries(answers.value).map(([questionId, answer]) => ({
        questionId,
        answer: normalizeAnswer(answer),
      })),
    });
    message.success('答案已提交，可回到列表进行批改');
    router.push('/app/assessments');
  } finally {
    submitting.value = false;
  }
}

function normalizeAnswer(answer: unknown): string | string[] | boolean {
  if (Array.isArray(answer)) return answer.map(String).sort();
  if (typeof answer === 'boolean') return answer;
  return String(answer ?? '');
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

.question-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
