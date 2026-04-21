<template>
  <div class="analytics-card">
    <div class="card-header">
      <span class="card-title">知识点薄弱分布</span>
      <a-radio-group v-model:value="viewMode" size="small" button-style="solid">
        <a-radio-button value="wordcloud">词云</a-radio-button>
        <a-radio-button value="list">列表</a-radio-button>
      </a-radio-group>
    </div>

    <!-- Word Cloud View -->
    <div v-if="viewMode === 'wordcloud'" class="wordcloud-container">
      <div v-if="analytics?.wordCloud && analytics.wordCloud.length > 0" class="wordcloud">
        <span
          v-for="item in analytics.wordCloud"
          :key="item.text"
          :class="['word-item', `level-${item.level}`]"
          :style="{ fontSize: `${Math.max(12, Math.min(32, item.weight * 3))}px` }"
        >
          {{ item.text }}
        </span>
      </div>
      <a-empty v-else description="暂无薄弱点数据，多进行对话后生成" />
    </div>

    <!-- List View -->
    <div v-else class="weakpoints-list">
      <div
        v-for="wp in analytics?.weakPoints"
        :key="wp.id"
        class="weakpoint-item"
      >
        <div class="wp-main">
          <a-tag :color="levelColor(wp.level)" class="wp-level-tag">
            {{ levelLabel(wp.level) }}
          </a-tag>
          <span class="wp-keyword">{{ wp.keyword }}</span>
          <span v-if="wp.relatedChapter" class="wp-chapter">{{ wp.relatedChapter }}</span>
        </div>
        <div class="wp-count">出现 {{ wp.count }} 次</div>
      </div>
      <a-empty v-if="!analytics?.weakPoints?.length" description="暂无薄弱点数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { LearningAnalytics, WeaknessLevel } from '@kaoyan/shared';

defineProps<{
  analytics: LearningAnalytics | null;
}>();

const viewMode = ref<'wordcloud' | 'list'>('wordcloud');

function levelColor(level: WeaknessLevel) {
  return { high: 'error', medium: 'warning', low: 'success' }[level];
}

function levelLabel(level: WeaknessLevel) {
  return { high: '高危', medium: '需注意', low: '良好' }[level];
}
</script>

<style scoped lang="less">
.analytics-card {
  background: #fff;
  border-radius: @radius-lg;
  padding: 20px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
  height: 100%;
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

.wordcloud-container {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wordcloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
  justify-content: center;
  padding: 16px;
  line-height: 1.5;
}

.word-item {
  cursor: default;
  font-family: @font-serif;
  font-weight: 500;
  transition: transform 0.2s;
  display: inline-block;
}

.word-item:hover {
  transform: scale(1.1);
}

.word-item.level-high { color: #ff4d4f; }
.word-item.level-medium { color: #d4a017; }
.word-item.level-low { color: #52c41a; }

.weakpoints-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 260px;
}

.weakpoint-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  background: @color-bg;
  border: 1px solid @color-border-light;
}

.wp-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.wp-level-tag { flex-shrink: 0; }
.wp-keyword { font-size: 14px; font-weight: 500; color: @color-text-primary; }
.wp-chapter { font-size: 12px; color: @color-text-muted; }
.wp-count { font-size: 12px; color: @color-text-muted; white-space: nowrap; }
</style>
