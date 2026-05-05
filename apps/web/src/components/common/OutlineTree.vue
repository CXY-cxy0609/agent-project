<template>
  <div class="outline-tree">
    <div v-if="outline.modules.length === 0" class="outline-empty">
      <a-empty :description="emptyText" />
    </div>

    <div
      v-for="module in outline.modules"
      :key="module.id"
      class="outline-module"
    >
      <div class="module-title" :class="getNodeClass(module.title)">
        <span class="module-num">{{ module.order }}</span>
        <span class="module-text">{{ module.title }}</span>
      </div>

      <div class="module-topics">
        <div
          v-for="topic in module.topics"
          :key="topic.id"
          class="topic-branch"
        >
          <div class="topic-item" :class="getNodeClass(topic.title)">
            <span class="topic-order">{{ module.order }}.{{ topic.order }}</span>
            <span>{{ topic.title }}</span>
          </div>
          <div class="topic-points">
            <div
              v-for="point in topic.points"
              :key="point.id"
              class="point-item"
              :class="getNodeClass(point.title)"
            >
              <span class="point-order">{{ module.order }}.{{ topic.order }}.{{ point.order }}</span>
              <span>{{ point.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SubjectOutline } from '@tutor/shared';

interface WeakPoint {
  keyword: string;
  level: string;
}

const props = withDefaults(
  defineProps<{
    outline: SubjectOutline;
    weakPoints?: WeakPoint[];
    emptyText?: string;
  }>(),
  {
    weakPoints: () => [],
    emptyText: '暂无大纲',
  },
);

function getNodeClass(sectionTitle: string) {
  if (!props.weakPoints?.length) return '';
  const wp = props.weakPoints.find(
    (w) => sectionTitle.includes(w.keyword) || w.keyword.includes(sectionTitle),
  );
  if (!wp) return '';
  return `node-${wp.level}`;
}
</script>

<style scoped lang="less">
.outline-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.outline-empty {
  padding: 20px 0;
}

.outline-module {
  border: 1px solid @color-border;
  border-radius: 12px;
  background: linear-gradient(180deg, #fff 0%, #f9fbff 100%);
  box-shadow: @shadow-sm;
  padding: 14px;
}

.module-title {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(26, 58, 110, 0.05);
  border: 1px solid rgba(26, 58, 110, 0.12);
  font-size: 15px;
  font-weight: 600;
  color: @color-text-primary;
}

.module-num {
  min-width: 26px;
  height: 26px;
  border-radius: 8px;
  background: @color-primary;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.module-text {
  word-break: break-all;
}

.module-topics {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  padding-left: 12px;
  border-left: 2px solid @color-border-light;
}

.topic-branch {
  position: relative;
  padding-left: 10px;
}

.topic-branch::before {
  content: '';
  position: absolute;
  top: 18px;
  left: -12px;
  width: 12px;
  border-top: 2px solid @color-border-light;
}

.topic-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid @color-border;
  font-size: 13px;
  color: @color-text-primary;
  box-shadow: 0 1px 0 rgba(26, 58, 110, 0.03);
}

.topic-order {
  font-family: @font-serif;
  color: @color-primary;
  font-size: 12px;
  flex-shrink: 0;
}

.topic-points {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-left: 28px;
}

.point-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 9px;
  border-radius: 999px;
  background: @color-bg;
  border: 1px solid @color-border;
  font-size: 12px;
  color: @color-text-secondary;
}

.point-order {
  color: @color-text-muted;
  font-size: 11px;
}

.node-high {
  background: rgba(255, 77, 79, 0.08);
  border-color: rgba(255, 77, 79, 0.3);
  color: #ff4d4f;
}

.node-medium {
  background: rgba(212, 160, 23, 0.08);
  border-color: rgba(212, 160, 23, 0.3);
  color: @color-accent-dark;
}

.node-low {
  background: rgba(82, 196, 26, 0.08);
  border-color: rgba(82, 196, 26, 0.3);
  color: #52c41a;
}
</style>
