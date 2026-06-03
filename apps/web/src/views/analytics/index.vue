<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">学情记录</h1>
        <p class="page-desc">查看各学科薄弱知识点分布，生成个性化复习建议</p>
      </div>
    </div>

    <div class="analytics-main">
      <!-- Subject Tabs -->
      <a-tabs
        v-model:activeKey="activeSubjectId"
        class="subject-tabs"
        type="card"
        @change="handleTabChange"
      >
        <a-tab-pane :key="0" tab="总分析" />
        <a-tab-pane
          v-for="subject in rootSubjects"
          :key="subject.id"
          :tab="subject.name"
        />
      </a-tabs>

      <a-spin :spinning="loading" class="analytics-content">
        <analytics-metric-cards :analytics="analytics" />

        <a-row :gutter="[16, 16]" class="hero-row">
          <a-col :xs="24" :xl="15">
            <streaming-summary-card
              :analytics="analytics"
              :generating="generatingSummary"
              :streamed-text="summaryDraft"
              :stage-text="summaryStageText"
              @generate="generateSummary"
            />
          </a-col>
          <a-col :xs="24" :xl="9">
            <action-plan-panel :analytics="analytics" />
          </a-col>
        </a-row>

        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :xl="15">
            <knowledge-risk-matrix :analytics="analytics" />
          </a-col>
          <a-col :xs="24" :xl="9">
            <weak-points-card :analytics="analytics" />
          </a-col>
        </a-row>

        <div class="outline-section">
          <subject-outline-card
            v-if="activeSubjectWithOutline"
            :subject="activeSubjectWithOutline"
            :weak-points="analytics?.weakPoints"
          />

          <div v-if="secondarySubjectsForOutline.length > 0" class="secondary-outline-grid">
            <subject-outline-card
              v-for="subject in secondarySubjectsForOutline"
              :key="subject.id"
              :subject="subject"
              :weak-points="analytics?.weakPoints"
            />
          </div>
        </div>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { analyticsApi } from '@/api/analytics';
import { subjectsApi } from '@/api/subjects';
import { useSubjectStore } from '@/stores/subject';
import ActionPlanPanel from '@/components/analytics/ActionPlanPanel.vue';
import AnalyticsMetricCards from '@/components/analytics/AnalyticsMetricCards.vue';
import KnowledgeRiskMatrix from '@/components/analytics/KnowledgeRiskMatrix.vue';
import StreamingSummaryCard from '@/components/analytics/StreamingSummaryCard.vue';
import WeakPointsCard from '@/components/analytics/WeakPointsCard.vue';
import SubjectOutlineCard from '@/components/analytics/SubjectOutlineCard.vue';
import type { AnalyticsSummaryStreamEvent, LearningAnalytics, UserSubject } from '@tutor/shared';

const subjectStore = useSubjectStore();

const loading = ref(false);
const generatingSummary = ref(false);
const activeSubjectId = ref<number>(0);
const analytics = ref<LearningAnalytics | null>(null);
const summaryDraft = ref('');
const summaryStageText = ref('');
let cancelSummaryStream: (() => void) | null = null;

const rootSubjects = computed(() =>
  subjectStore.subjects
    .filter((subject) => subject.level === 1)
    .sort((a, b) => a.id - b.id),
);

const activeSubject = computed(() =>
  rootSubjects.value.find((s) => s.id === activeSubjectId.value),
);

const activeSubjectWithOutline = computed(() => {
  if (!activeSubject.value?.outline) return null;
  return activeSubject.value as UserSubject & { outline: NonNullable<UserSubject['outline']> };
});

const secondarySubjectsForOutline = computed(() =>
  subjectStore.subjects
    .filter((subject) => subject.level === 2 && subject.parentId === activeSubjectId.value)
    .sort((a, b) => a.id - b.id)
    .map((subject) => ({
      ...subject,
      outline: subject.outline ?? { modules: [] },
    })) as Array<UserSubject & { outline: NonNullable<UserSubject['outline']> }>,
);

async function loadAnalytics() {
  loading.value = true;
  try {
    analytics.value = await analyticsApi.getAnalytics(
      activeSubjectId.value === 0 ? null : activeSubjectId.value,
      activeSubjectId.value === 0 ? 'overall' : 'subject',
    );
  } catch {
    analytics.value = buildEmptyAnalytics();
  } finally {
    loading.value = false;
  }
}

function handleTabChange(id: number) {
  subjectStore.setActiveSubject(id);
  activeSubjectId.value = id;
  loadAnalytics();
}

async function generateSummary() {
  if (generatingSummary.value) return;
  cancelSummaryStream?.();
  generatingSummary.value = true;
  summaryDraft.value = '';
  summaryStageText.value = '正在连接学情分析服务...';
  cancelSummaryStream = analyticsApi.streamSummary(
    activeSubjectId.value === 0 ? null : activeSubjectId.value,
    activeSubjectId.value === 0 ? 'overall' : 'subject',
    handleSummaryEvent,
    (err) => {
      generatingSummary.value = false;
      summaryStageText.value = '';
      message.error(err.message || '学情总结生成失败');
    },
  );
}

function handleSummaryEvent(event: AnalyticsSummaryStreamEvent) {
  switch (event.type) {
    case 'summary.stage':
      summaryStageText.value = event.message;
      break;
    case 'summary.delta':
      summaryDraft.value += event.delta;
      break;
    case 'summary.saved':
      if (analytics.value) {
        analytics.value.summary = event.summary.summary;
        analytics.value.summaryDetail = event.summary;
        analytics.value.summaryGeneratedAt = event.summary.generatedAt ?? new Date().toISOString();
      }
      break;
    case 'summary.done':
      generatingSummary.value = false;
      summaryStageText.value = '';
      summaryDraft.value = '';
      message.success('学情总结已生成');
      break;
    default:
      break;
  }
}

onMounted(async () => {
  await subjectsApi.getMySubjects().then((list) => subjectStore.setSubjects(list)).catch(() => {});
  if (rootSubjects.value.length > 0) {
    const preferredId = subjectStore.activeSubjectId;
    const initialRoot =
      rootSubjects.value.find((subject) => subject.id === preferredId) ??
      rootSubjects.value.find((subject) => subject.id === subjectStore.subjects.find((s) => s.id === preferredId)?.parentId) ??
      rootSubjects.value[0];
    activeSubjectId.value = initialRoot?.id ?? 0;
  }
  await loadAnalytics();
});

function buildEmptyAnalytics(): LearningAnalytics {
  return {
    userId: 'current',
    scope: activeSubjectId.value === 0 ? 'overall' : 'subject',
    subjectId: activeSubjectId.value === 0 ? null : activeSubjectId.value,
    subjectName: activeSubject.value?.name ?? null,
    weakPoints: [],
    wordCloud: [],
    summaryDetail: null,
    updatedAt: new Date().toISOString(),
  };
}
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
  flex-wrap: wrap;
  gap: 12px;
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

.empty-subjects {
  margin-top: 60px;
}

.subject-tabs {
  margin-bottom: 20px;
  :deep(.ant-tabs-nav-wrap) {
    overflow-x: auto;
  }
}

:deep(.ant-tabs-card .ant-tabs-tab) {
  border-radius: 8px 8px 0 0 !important;
}

:deep(.ant-tabs-card .ant-tabs-tab-active) {
  background: @color-primary !important;
  border-color: @color-primary !important;
}

:deep(.ant-tabs-card .ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #fff !important;
}

.analytics-content {
  width: 100%;
  overflow: visible;
}

.hero-row {
  margin-top: 16px;
  margin-bottom: 16px;
}

.outline-section {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.secondary-outline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.analytics-side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
