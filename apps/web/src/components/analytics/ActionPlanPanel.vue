<template>
  <div class="action-card">
    <div class="card-header">
      <div>
        <div class="eyebrow">Next Best Actions</div>
        <h3>下一步行动</h3>
      </div>
    </div>

    <div v-if="actions.length" class="action-list">
      <div v-for="(action, index) in actions" :key="`${action.title}-${index}`" class="action-item">
        <div class="action-index">{{ index + 1 }}</div>
        <div class="action-content">
          <div class="action-title">{{ action.title }}</div>
          <div class="action-reason">{{ action.reason || action.description }}</div>
        </div>
        <a-tag>{{ actionTypeLabel(action.type) }}</a-tag>
      </div>
    </div>
    <a-empty v-else description="生成学情总结后会给出行动建议" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsSummaryAction, LearningAnalytics } from '@tutor/shared';

const props = defineProps<{
  analytics: LearningAnalytics | null;
}>();

type ActionItem = AnalyticsSummaryAction & { description?: string };

const actions = computed<ActionItem[]>(() => {
  const summaryActions = props.analytics?.summaryDetail?.recommendedActions ?? [];
  if (summaryActions.length) return summaryActions;
  return (props.analytics?.recommendations ?? []).map((item) => ({
    type: item.type,
    title: item.title,
    reason: item.description,
    description: item.description,
    knowledgeKey: item.knowledgeKey,
    subjectId: item.subjectId,
  }));
});

function actionTypeLabel(type: string) {
  return {
    review: '复习',
    assessment: '测试',
    subject_create: '学科',
    knowledge_base: '知识库',
  }[type] ?? '行动';
}
</script>

<style scoped lang="less">
.action-card {
  height: 100%;
  padding: 22px;
  border: 1px solid @color-border;
  border-radius: 18px;
  background: #fff;
  box-shadow: @shadow-sm;
}

.card-header {
  margin-bottom: 16px;
}

.eyebrow {
  font-size: 12px;
  color: @color-primary-light;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h3 {
  margin: 4px 0 0;
  font-family: @font-serif;
  color: @color-text-primary;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: #f8faff;
  border: 1px solid @color-border-light;
}

.action-index {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  color: #fff;
  background: @color-primary;
  font-weight: 700;
}

.action-content {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-weight: 600;
  color: @color-text-primary;
}

.action-reason {
  margin-top: 4px;
  color: @color-text-muted;
  font-size: 12px;
  line-height: 1.6;
}
</style>
