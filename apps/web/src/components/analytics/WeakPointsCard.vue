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
      <v-chart v-if="wordCloudData.length > 0" class="wordcloud-chart" :option="wordCloudOption" autoresize />
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
import { computed, ref } from 'vue';
import { use } from 'echarts/core';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import 'echarts-wordcloud';
import type { LearningAnalytics, WeaknessLevel } from '@tutor/shared';

use([CanvasRenderer, TooltipComponent]);

const props = defineProps<{
  analytics: LearningAnalytics | null;
}>();

const viewMode = ref<'wordcloud' | 'list'>('wordcloud');

const wordCloudData = computed(() => {
  const source = props.analytics?.wordCloud ?? [];
  const maxWeight = Math.max(...source.map((item) => item.weight), 1);
  const minWeight = Math.min(...source.map((item) => item.weight), 0);
  return source.slice(0, 36).map((item) => {
    const normalized = maxWeight === minWeight ? 0.6 : (item.weight - minWeight) / (maxWeight - minWeight);
    return {
      name: item.text,
      value: item.weight,
      textStyle: {
        color: levelStroke(item.level),
        fontSize: 14 + normalized * 18,
        fontWeight: item.level === 'high' ? 800 : 600,
        fontFamily: 'Noto Serif SC, Songti SC, serif',
      },
      emphasis: {
        textStyle: {
          color: levelStroke(item.level),
          textShadowBlur: 8,
          textShadowColor: 'rgba(26, 58, 110, 0.18)',
        },
      },
      level: item.level,
    };
  });
});

const wordCloudOption = computed(() => ({
  animationDuration: 500,
  tooltip: {
    formatter: (params: { name: string; value: number }) => `${params.name}<br/>权重：${params.value}`,
  },
  series: [{
    type: 'wordCloud',
    shape: 'circle',
    width: '96%',
    height: '92%',
    left: 'center',
    top: 'center',
    sizeRange: [14, 34],
    rotationRange: [-18, 18],
    rotationStep: 18,
    gridSize: 12,
    drawOutOfBound: false,
    shrinkToFit: true,
    layoutAnimation: true,
    data: wordCloudData.value,
  }],
}));

function levelColor(level: WeaknessLevel) {
  return { high: 'error', medium: 'warning', low: 'success' }[level];
}

function levelLabel(level: WeaknessLevel) {
  return { high: '高危', medium: '需注意', low: '良好' }[level];
}

function levelStroke(level: WeaknessLevel) {
  return { high: '#c2413a', medium: '#9a6700', low: '#2f855a' }[level];
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
  height: 300px;
}

.wordcloud-chart { width: 100%; height: 100%; }

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
