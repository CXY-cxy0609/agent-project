<template>
  <div class="analytics-card summary-card">
    <div class="card-header">
      <span class="card-title">学情总结</span>
      <a-tooltip title="根据对话记录 AI 生成分析报告">
        <QuestionCircleOutlined class="help-icon" />
      </a-tooltip>
    </div>

    <div v-if="analytics?.summary" class="summary-content">
      <div class="summary-text">{{ analytics.summary }}</div>
      <div class="summary-time">生成于 {{ formatDate(analytics.summaryGeneratedAt) }}</div>
    </div>

    <div v-else class="summary-empty">
      <div class="summary-empty-text">
        点击下方按钮，AI 将分析您的学习记录并生成个性化复习建议
      </div>
    </div>

    <a-button
      type="primary"
      block
      :loading="generatingSummary"
      class="generate-btn"
      @click="$emit('generate')"
    >
      <SyncOutlined v-if="!generatingSummary" />
      {{ analytics?.summary ? '重新生成总结' : '生成学情总结' }}
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { QuestionCircleOutlined, SyncOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { LearningAnalytics } from '@tutor/shared';

defineProps<{
  analytics: LearningAnalytics | null;
  generatingSummary: boolean;
}>();

defineEmits<{
  generate: [];
}>();

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
}
</script>

<style scoped lang="less">
.analytics-card {
  background: #fff;
  border-radius: @radius-lg;
  padding: 20px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
}

.summary-card {
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: @color-text-primary;
  font-family: @font-serif;
}

.help-icon {
  color: @color-text-muted;
  cursor: help;
}

.summary-content {
  flex: 1;
  margin-bottom: 16px;
}

.summary-text {
  font-size: 14px;
  line-height: 1.8;
  color: @color-text-secondary;
}

.summary-time {
  font-size: 12px;
  color: @color-text-muted;
  margin-top: 8px;
}

.summary-empty {
  flex: 1;
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.summary-empty-text {
  font-size: 13px;
  color: @color-text-muted;
  line-height: 1.7;
  text-align: center;
}

.generate-btn {
  background: linear-gradient(135deg, @color-primary, @color-primary-light) !important;
  border: none !important;
  border-radius: 8px !important;
}
</style>
