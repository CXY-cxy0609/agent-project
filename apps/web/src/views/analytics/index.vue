<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">学情记录</h1>
        <p class="page-desc">查看各学科薄弱知识点分布，生成个性化复习建议</p>
      </div>
    </div>

    <div v-if="subjectStore.subjects.length === 0" class="empty-subjects">
      <a-result
        status="info"
        title="暂无学科"
        sub-title="请先前往学科管理添加学科，才能查看学情记录。"
      >
        <template #extra>
          <a-button type="primary" @click="$router.push('/app/subjects')">前往学科管理</a-button>
        </template>
      </a-result>
    </div>

    <template v-else>
      <!-- Subject Tabs -->
      <a-tabs
        v-model:activeKey="activeSubjectId"
        class="subject-tabs"
        type="card"
        @change="handleTabChange"
      >
        <a-tab-pane
          v-for="subject in rootSubjects"
          :key="subject.id"
          :tab="subject.name"
        />
      </a-tabs>

      <a-spin :spinning="loading" class="analytics-content">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :xl="16">
            <weak-points-card :analytics="analytics" />
          </a-col>

          <a-col :xs="24" :xl="8">
            <div class="analytics-side-column">
              <analytics-summary-card
                :analytics="analytics"
                :generating-summary="generatingSummary"
                @generate="generateSummary"
              />
              <analytics-stats-card :analytics="analytics" />
            </div>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { analyticsApi } from '@/api/analytics';
import { subjectsApi } from '@/api/subjects';
import { useSubjectStore } from '@/stores/subject';
import WeakPointsCard from '@/components/analytics/WeakPointsCard.vue';
import AnalyticsSummaryCard from '@/components/analytics/AnalyticsSummaryCard.vue';
import AnalyticsStatsCard from '@/components/analytics/AnalyticsStatsCard.vue';
import SubjectOutlineCard from '@/components/analytics/SubjectOutlineCard.vue';
import type { LearningAnalytics, UserSubject } from '@tutor/shared';

const subjectStore = useSubjectStore();

const loading = ref(false);
const generatingSummary = ref(false);
const activeSubjectId = ref<number>();
const analytics = ref<LearningAnalytics | null>(null);

const rootSubjects = computed(() =>
  subjectStore.subjects
    .filter((subject) => subject.level === 1)
    .sort((a, b) => a.code - b.code),
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
    .sort((a, b) => a.code - b.code)
    .map((subject) => ({
      ...subject,
      outline: subject.outline ?? { modules: [] },
    })) as Array<UserSubject & { outline: NonNullable<UserSubject['outline']> }>,
);

async function loadAnalytics() {
  if (activeSubjectId.value === undefined) return;
  loading.value = true;
  try {
    analytics.value = await analyticsApi.getAnalytics(activeSubjectId.value);
  } catch {
    analytics.value = null;
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
  if (activeSubjectId.value === undefined) return;
  generatingSummary.value = true;
  try {
    const result = await analyticsApi.generateSummary(activeSubjectId.value);
    if (analytics.value) {
      analytics.value.summary = result.summary;
      analytics.value.summaryGeneratedAt = new Date().toISOString();
    }
    message.success('学情总结已生成');
  } finally {
    generatingSummary.value = false;
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
    activeSubjectId.value = initialRoot.id;
    await loadAnalytics();
  }
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
