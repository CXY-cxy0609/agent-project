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
        @change="loadAnalytics"
      >
        <a-tab-pane
          v-for="subject in subjectStore.subjects"
          :key="subject.id"
          :tab="subject.name"
        />
      </a-tabs>

      <a-spin :spinning="loading" class="analytics-content">
        <a-row :gutter="[16, 16]">
          <a-col :span="16">
            <weak-points-card :analytics="analytics" />
          </a-col>

          <a-col :span="8">
            <analytics-summary-card
              :analytics="analytics"
              :generating-summary="generatingSummary"
              @generate="generateSummary"
            />
            <analytics-stats-card
              :analytics="analytics"
              style="margin-top: 16px"
            />
          </a-col>
        </a-row>

        <subject-outline-card
          v-if="activeSubject?.outline"
          :subject="activeSubject"
          :weak-points="analytics?.weakPoints"
          style="margin-top: 16px"
        />
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
import type { LearningAnalytics } from '@kaoyan/shared';

const subjectStore = useSubjectStore();

const loading = ref(false);
const generatingSummary = ref(false);
const activeSubjectId = ref<string>('');
const analytics = ref<LearningAnalytics | null>(null);

const activeSubject = computed(() =>
  subjectStore.subjects.find((s) => s.id === activeSubjectId.value),
);

async function loadAnalytics() {
  if (!activeSubjectId.value) return;
  loading.value = true;
  try {
    analytics.value = await analyticsApi.getAnalytics(activeSubjectId.value);
  } catch {
    analytics.value = null;
  } finally {
    loading.value = false;
  }
}

async function generateSummary() {
  if (!activeSubjectId.value) return;
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
  if (subjectStore.subjects.length > 0) {
    activeSubjectId.value = subjectStore.activeSubjectId || subjectStore.subjects[0].id;
    await loadAnalytics();
  }
});
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
}

.page-header {
  margin-bottom: 20px;
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
}
</style>
