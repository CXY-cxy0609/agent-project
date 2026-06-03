<template>
  <div class="summary-card">
    <div class="summary-header">
      <div>
        <div class="eyebrow">AI Learning Insight</div>
        <h2>学情总结</h2>
      </div>
      <a-tag :color="riskColor">{{ riskText }}</a-tag>
    </div>

    <div class="summary-body">
      <div v-if="stageText" class="stage-line">
        <span class="pulse" />
        {{ stageText }}
      </div>
      <div v-if="displayText" class="summary-text markdown-body" v-html="renderedSummary"></div>
      <div v-else class="empty-text">点击生成后，AI 会基于学习记录、薄弱点和测评数据输出诊断建议。</div>
    </div>

    <div v-if="summaryDetail?.highlights?.length" class="summary-section">
      <div class="section-title">学习亮点</div>
      <div v-for="item in summaryDetail.highlights" :key="item" class="section-item">{{ item }}</div>
    </div>

    <div v-if="summaryDetail?.weakPointAnalysis?.length" class="summary-section">
      <div class="section-title">薄弱分析</div>
      <div v-for="item in summaryDetail.weakPointAnalysis" :key="item" class="section-item danger">{{ item }}</div>
    </div>

    <div class="summary-footer">
      <span class="generated-at">{{ generatedAtText }}</span>
      <a-button type="primary" :loading="generating" @click="$emit('generate')">
        {{ analytics?.summary ? '重新生成总结' : '生成学情总结' }}
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { renderMarkdown } from '@/utils/markdown';
import type { AnalyticsSummaryDetail, LearningAnalytics } from '@tutor/shared';

const props = defineProps<{
  analytics: LearningAnalytics | null;
  generating: boolean;
  streamedText: string;
  stageText: string;
}>();

defineEmits<{
  generate: [];
}>();

const summaryDetail = computed<AnalyticsSummaryDetail | null | undefined>(() => props.analytics?.summaryDetail);
const displayText = computed(() => props.streamedText || props.analytics?.summary || '');
const renderedSummary = computed(() => renderMarkdown(displayText.value));
const risk = computed(() => summaryDetail.value?.riskLevel ?? 'low');
const riskText = computed(() => ({ high: '高风险', medium: '需关注', low: '稳定' })[risk.value]);
const riskColor = computed(() => ({ high: 'red', medium: 'orange', low: 'green' })[risk.value]);
const generatedAtText = computed(() => {
  const raw = summaryDetail.value?.generatedAt ?? props.analytics?.summaryGeneratedAt;
  return raw ? `最近生成：${dayjs(raw).format('YYYY-MM-DD HH:mm')}` : '暂无历史总结';
});
</script>

<style scoped lang="less">
.summary-card {
  min-height: 430px;
  padding: 24px;
  border: 1px solid rgba(42, 82, 152, 0.14);
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(42, 82, 152, 0.12), transparent 34%),
    linear-gradient(145deg, #fff, #f7faff);
  box-shadow: @shadow-md;
}

.summary-header,
.summary-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: @color-primary-light;
  text-transform: uppercase;
}

h2 {
  margin: 4px 0 0;
  font-family: @font-serif;
  font-size: 22px;
  color: @color-text-primary;
}

.summary-body {
  margin-top: 20px;
  min-height: 180px;
}

.stage-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: @color-primary-light;
  font-size: 13px;
}

.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: @color-primary-light;
  box-shadow: 0 0 0 6px rgba(42, 82, 152, 0.12);
}

.summary-text {
  line-height: 1.85;
  color: @color-text-secondary;
  font-size: 14px;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 18px 0 8px;
  color: @color-text-primary;
  font-family: @font-serif;
  line-height: 1.35;
}

.markdown-body :deep(h1) {
  font-size: 22px;
}

.markdown-body :deep(h2) {
  font-size: 18px;
}

.markdown-body :deep(h3) {
  font-size: 16px;
}

.markdown-body :deep(p) {
  margin: 8px 0;
}

.markdown-body :deep(ol),
.markdown-body :deep(ul) {
  margin: 8px 0 8px 20px;
  padding: 0;
}

.markdown-body :deep(li) {
  margin: 6px 0;
  line-height: 1.8;
}

.empty-text {
  color: @color-text-muted;
  line-height: 1.8;
}

.summary-section {
  margin-top: 16px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid @color-border-light;
}

.section-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: @color-text-primary;
}

.section-item {
  padding: 6px 0;
  color: @color-text-secondary;
}

.section-item.danger {
  color: #8a4b16;
}

.summary-footer {
  margin-top: 20px;
}

.generated-at {
  color: @color-text-muted;
  font-size: 12px;
}
</style>
