<template>
  <div class="matrix-card">
    <div class="card-header">
      <div>
        <div class="eyebrow">Risk Matrix</div>
        <h3>知识点风险矩阵</h3>
      </div>
      <span class="hint">频次 × 薄弱程度</span>
    </div>

    <div v-if="points.length" class="matrix-plot">
      <div class="axis-label y">薄弱程度</div>
      <div class="axis-label x">出现频次</div>
      <div class="quadrant urgent">优先处理</div>
      <div class="quadrant observe">持续观察</div>
      <button
        v-for="point in points"
        :key="point.id"
        class="risk-dot"
        :class="point.level"
        :style="{ left: `${point.x}%`, bottom: `${point.y}%` }"
        :title="point.keyword"
      >
        <span>{{ point.keyword }}</span>
      </button>
    </div>
    <a-empty v-else description="暂无知识点风险数据" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LearningAnalytics } from '@tutor/shared';

const props = defineProps<{
  analytics: LearningAnalytics | null;
}>();

const points = computed(() => {
  const list = props.analytics?.weakPoints ?? [];
  const maxCount = Math.max(...list.map((item) => item.count), 1);
  return list.slice(0, 12).map((item) => ({
    ...item,
    x: Math.max(8, Math.min(88, (item.count / maxCount) * 82)),
    y: Math.max(10, Math.min(86, item.weaknessScore ?? levelScore(item.level))),
  }));
});

function levelScore(level: string) {
  return { high: 82, medium: 56, low: 28 }[level] ?? 32;
}
</script>

<style scoped lang="less">
.matrix-card {
  padding: 22px;
  border: 1px solid @color-border;
  border-radius: 18px;
  background: #fff;
  box-shadow: @shadow-sm;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
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

.hint {
  color: @color-text-muted;
  font-size: 12px;
}

.matrix-plot {
  position: relative;
  height: 320px;
  overflow: hidden;
  border-radius: 16px;
  background:
    linear-gradient(90deg, rgba(26, 58, 110, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(26, 58, 110, 0.08) 1px, transparent 1px),
    linear-gradient(135deg, #f8fbff, #fff8f2);
  background-size: 25% 25%, 25% 25%, 100% 100%;
  border: 1px solid @color-border-light;
}

.axis-label {
  position: absolute;
  color: @color-text-muted;
  font-size: 12px;
}

.axis-label.y {
  left: 12px;
  top: 12px;
}

.axis-label.x {
  right: 12px;
  bottom: 10px;
}

.quadrant {
  position: absolute;
  right: 16px;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.urgent {
  top: 16px;
  color: #9f2f28;
  background: rgba(255, 77, 79, 0.1);
}

.observe {
  bottom: 38px;
  color: @color-primary;
  background: rgba(42, 82, 152, 0.08);
}

.risk-dot {
  position: absolute;
  transform: translate(-50%, 50%);
  max-width: 128px;
  border: 0;
  border-radius: 999px;
  padding: 7px 10px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  box-shadow: @shadow-md;
}

.risk-dot.high { background: #c2413a; }
.risk-dot.medium { background: #c47a20; }
.risk-dot.low { background: #2f855a; }

.risk-dot span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
