<template>
  <div class="metric-grid">
    <div v-for="item in metrics" :key="item.key" class="metric-card" :class="item.tone">
      <div class="metric-label">{{ item.label }}</div>
      <div class="metric-value">{{ item.value }}</div>
      <div class="metric-desc">{{ item.desc }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LearningAnalytics } from '@tutor/shared';

const props = defineProps<{
  analytics: LearningAnalytics | null;
}>();

const highRiskCount = computed(
  () => props.analytics?.weakPoints.filter((item) => item.level === 'high').length ?? 0,
);

const riskLevel = computed(() => {
  const level = props.analytics?.summaryDetail?.riskLevel;
  if (level) return level;
  if (highRiskCount.value >= 3) return 'high';
  if (highRiskCount.value > 0) return 'medium';
  return 'low';
});

const metrics = computed(() => {
  const cards = props.analytics?.cards;
  return [
    {
      key: 'mastery',
      label: '综合掌握度',
      value: `${cards?.masteryScore ?? 0}`,
      desc: cards?.trend ? `趋势 ${cards.trend}` : '基于知识点掌握度估算',
      tone: 'primary',
    },
    {
      key: 'risk',
      label: '学习风险',
      value: riskLabel(riskLevel.value),
      desc: '结合薄弱点数量与 AI 诊断',
      tone: riskLevel.value,
    },
    {
      key: 'weak',
      label: '高危知识点',
      value: `${highRiskCount.value}`,
      desc: `共 ${props.analytics?.weakPoints.length ?? 0} 个薄弱点`,
      tone: highRiskCount.value > 0 ? 'high' : 'low',
    },
    {
      key: 'activity',
      label: '学习活跃度',
      value: `${cards?.activeDays ?? 0} 天`,
      desc: `${cards?.totalQuestions ?? 0} 条学习记录`,
      tone: 'neutral',
    },
  ];
});

function riskLabel(level: string) {
  return { high: '高风险', medium: '需关注', low: '稳定' }[level] ?? '稳定';
}
</script>

<style scoped lang="less">
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  position: relative;
  overflow: hidden;
  min-height: 118px;
  padding: 18px;
  border: 1px solid @color-border;
  border-radius: 18px;
  background: linear-gradient(145deg, #fff, #f7f9ff);
  box-shadow: @shadow-sm;
}

.metric-card::after {
  content: '';
  position: absolute;
  right: -24px;
  top: -24px;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: rgba(26, 58, 110, 0.08);
}

.metric-label {
  font-size: 13px;
  color: @color-text-muted;
}

.metric-value {
  margin-top: 12px;
  font-family: @font-serif;
  font-size: 30px;
  font-weight: 700;
  color: @color-primary;
}

.metric-desc {
  margin-top: 8px;
  font-size: 12px;
  color: @color-text-secondary;
}

.metric-card.high .metric-value { color: #c2413a; }
.metric-card.medium .metric-value { color: #b7791f; }
.metric-card.low .metric-value { color: #2f855a; }
.metric-card.neutral .metric-value { color: @color-primary-light; }

@media (max-width: 1024px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
