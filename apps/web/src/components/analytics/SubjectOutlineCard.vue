<template>
  <div class="analytics-card outline-card">
    <div class="card-header">
      <span class="card-title">{{ subject.name }} 大纲</span>
      <span class="outline-legend">
        <span class="legend-item high">高危</span>
        <span class="legend-item medium">需注意</span>
        <span class="legend-item low">良好</span>
      </span>
    </div>
    <outline-tree
      :outline="subject.outline"
      :weak-points="weakPoints"
    />
  </div>
</template>

<script setup lang="ts">
import OutlineTree from '@/components/common/OutlineTree.vue';
import type { UserSubject } from '@kaoyan/shared';

interface WeakPoint {
  keyword: string;
  level: string;
}

defineProps<{
  subject: UserSubject & { outline: NonNullable<UserSubject['outline']> };
  weakPoints?: WeakPoint[];
}>();
</script>

<style scoped lang="less">
.analytics-card {
  background: #fff;
  border-radius: @radius-lg;
  padding: 20px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
}

.outline-card {
  min-height: auto;
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

.outline-legend {
  display: flex;
  gap: 12px;
}

.legend-item {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-item::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.legend-item.high::before { background: #ff4d4f; }
.legend-item.medium::before { background: #d4a017; }
.legend-item.low::before { background: #52c41a; }
</style>
