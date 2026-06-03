<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">测试训练</h1>
        <p class="page-desc">管理测试、继续作答，并将批改结果反馈到学情分析。</p>
      </div>
      <a-button type="primary" @click="createOpen = true">生成测试题</a-button>
    </div>

    <a-row :gutter="[16, 16]" class="stats-row">
      <a-col :xs="12" :md="6"><a-card><a-statistic title="待作答" :value="statusCount.answering" /></a-card></a-col>
      <a-col :xs="12" :md="6"><a-card><a-statistic title="待批改" :value="statusCount.submitted" /></a-card></a-col>
      <a-col :xs="12" :md="6"><a-card><a-statistic title="已批改" :value="statusCount.graded" /></a-card></a-col>
      <a-col :xs="12" :md="6"><a-card><a-statistic title="生成中" :value="statusCount.generating" /></a-card></a-col>
    </a-row>

    <a-card title="测试历史" class="history-card">
      <a-space class="history-toolbar">
        <a-select v-model:value="historySubjectFilter" style="width: 180px" @change="loadHistory">
          <a-select-option value="overall">全部学科</a-select-option>
          <a-select-option value="unassigned">未归属</a-select-option>
          <a-select-option v-for="subject in subjectStore.subjects" :key="subject.id" :value="subject.id">
            {{ subject.name }}
          </a-select-option>
        </a-select>
        <a-select v-model:value="historyStatus" allow-clear placeholder="状态" style="width: 140px" @change="loadHistory">
          <a-select-option value="generating">生成中</a-select-option>
          <a-select-option value="answering">待作答</a-select-option>
          <a-select-option value="submitted">待批改</a-select-option>
          <a-select-option value="graded">已批改</a-select-option>
          <a-select-option value="failed">生成失败</a-select-option>
        </a-select>
      </a-space>
      <a-alert v-if="gradingStageText" class="grading-stage" type="info" :message="gradingStageText" show-icon />
      <assessment-history-table
        :items="historyList"
        :loading="historyLoading"
        :grading-id="gradingId"
        @take="goTake"
        @grade="gradeAssessment"
        @result="goResult"
        @regenerate="regenerateAssessment"
      />
    </a-card>

    <assessment-create-modal
      v-model:open="createOpen"
      :generating="generating"
      :subjects="subjectStore.subjects"
      @generate="streamGenerateAssessment"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { assessmentsApi } from '@/api/assessments';
import { subjectsApi } from '@/api/subjects';
import { useSubjectStore } from '@/stores/subject';
import AssessmentCreateModal from '@/components/assessments/AssessmentCreateModal.vue';
import AssessmentHistoryTable from '@/components/assessments/AssessmentHistoryTable.vue';
import type {
  Assessment,
  AssessmentGenerationStreamEvent,
  AssessmentGradeStreamEvent,
  AssessmentStatus,
  GenerateAssessmentRequest,
} from '@tutor/shared';

const subjectStore = useSubjectStore();
const router = useRouter();

const createOpen = ref(false);
const generating = ref(false);
const grading = ref(false);
const gradingId = ref('');
const gradingStageText = ref('');
const historySubjectFilter = ref<number | 'overall' | 'unassigned'>('overall');
const historyStatus = ref<AssessmentStatus | undefined>();
const historyList = ref<Assessment[]>([]);
const historyLoading = ref(false);

const statusCount = computed(() => {
  const result = { generating: 0, answering: 0, submitted: 0, graded: 0 };
  for (const item of historyList.value) {
    if (item.status in result) result[item.status as keyof typeof result]++;
  }
  return result;
});

function streamGenerateAssessment(request: GenerateAssessmentRequest) {
  generating.value = true;
  createOpen.value = false;
  assessmentsApi.streamGenerate(request, handleGenerateEvent, (err) => {
    generating.value = false;
    message.error(err.message || '测试题生成失败');
    loadHistory();
  });
}

function regenerateAssessment(id: string) {
  generating.value = true;
  assessmentsApi.streamRegenerate(id, handleGenerateEvent, (err) => {
    generating.value = false;
    message.error(err.message || '测试题重新生成失败');
    loadHistory();
  });
}

function handleGenerateEvent(event: AssessmentGenerationStreamEvent) {
  if (event.type === 'assessment.start' || event.type === 'assessment.saved') {
    upsertHistory(event.assessment);
  }
  if (event.type === 'assessment.stage' || event.type === 'assessment.question.created') {
    patchHistory(event.assessmentId, {
      status: 'generating',
      statusLabel: '生成中',
      generatedCount: event.generatedCount ?? 0,
      questionCount: event.totalCount ?? 0,
    });
  }
  if (event.type === 'assessment.done') {
    grading.value = false;
    generating.value = false;
    message.success('测试题已生成，可稍后作答');
    loadHistory();
  }
}

function upsertHistory(item: Assessment) {
  const index = historyList.value.findIndex((record) => record.id === item.id);
  if (index >= 0) {
    historyList.value[index] = { ...historyList.value[index], ...item };
    return;
  }
  historyList.value = [item, ...historyList.value];
}

function patchHistory(id: string, patch: Partial<Assessment>) {
  historyList.value = historyList.value.map((item) => (
    item.id === id ? { ...item, ...patch } : item
  ));
}

async function loadHistory() {
  historyLoading.value = true;
  try {
    const result = await assessmentsApi.list({
      scope: historySubjectFilter.value === 'unassigned' ? 'unassigned' : 'overall',
      subjectId: typeof historySubjectFilter.value === 'number' ? historySubjectFilter.value : null,
      status: historyStatus.value,
      page: 1,
      pageSize: 20,
    });
    historyList.value = result.list;
  } finally {
    historyLoading.value = false;
  }
}

function gradeAssessment(id: string) {
  grading.value = true;
  gradingId.value = id;
  gradingStageText.value = '正在启动批改...';
  assessmentsApi.streamGrade(id, handleGradeEvent, (err) => {
    grading.value = false;
    gradingId.value = '';
    gradingStageText.value = '';
    message.error(err.message || '批改失败');
    loadHistory();
  });
}

function handleGradeEvent(event: AssessmentGradeStreamEvent) {
  if (event.type === 'assessment.grade.stage') {
    gradingStageText.value = event.message;
  }
  if (event.type === 'assessment.grade.done') {
    grading.value = false;
    gradingId.value = '';
    gradingStageText.value = '';
    message.success(`批改完成，得分 ${event.result.totalScore}/${event.result.maxScore}`);
    loadHistory();
    goResult(event.assessmentId);
  }
}

function goTake(id: string) {
  router.push(`/app/assessments/${id}/take`);
}

function goResult(id: string) {
  router.push(`/app/assessments/${id}/result`);
}

onMounted(async () => {
  await subjectsApi.getMySubjects().then((list) => subjectStore.setSubjects(list)).catch(() => {});
  await loadHistory();
});
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
  max-width: 1400px;
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

.stats-row {
  margin-bottom: 16px;
}

.history-card {
  margin-top: 16px;
}

.history-toolbar {
  margin-bottom: 12px;
}

.grading-stage {
  margin-bottom: 12px;
}

</style>
