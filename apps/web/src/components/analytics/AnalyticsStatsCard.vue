<template>
  <div class="analytics-card stats-card">
    <div class="card-header">
      <span class="card-title">本学科数据</span>
    </div>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-num">{{ analytics?.weakPoints?.length ?? 0 }}</div>
        <div class="stat-name">薄弱点</div>
      </div>
      <div class="stat-box">
        <div class="stat-num high">{{ highLevelCount }}</div>
        <div class="stat-name">高危知识点</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">{{ analytics?.wordCloud?.length ?? 0 }}</div>
        <div class="stat-name">涉及词汇</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LearningAnalytics } from '@kaoyan/shared';

const props = defineProps<{
  analytics: LearningAnalytics | null;
}>();

const highLevelCount = computed(
  () => props.analytics?.weakPoints?.filter((w) => w.level === 'high').length ?? 0,
);
</script>

<style scoped lang="less">
.analytics-card {
  background: #fff;
  border-radius: @radius-lg;
  padding: 16px 20px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 4px;
}

.stat-box {
  text-align: center;
  padding: 12px 8px;
  background: @color-bg;
  border-radius: 8px;
}

.stat-num {
  font-family: @font-serif;
  font-size: 24px;
  font-weight: 700;
  color: @color-primary;
}

.stat-num.high {
  color: #ff4d4f;
}

.stat-name {
  font-size: 11px;
  color: @color-text-muted;
  margin-top: 4px;
}
</style>
