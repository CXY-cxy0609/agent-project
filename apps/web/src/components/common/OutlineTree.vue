<template>
  <div class="outline-tree">
    <div v-if="outline.chapters.length === 0" class="outline-empty">
      <a-empty :description="emptyText" />
    </div>

    <div
      v-for="chapter in outline.chapters"
      :key="chapter.id"
      class="outline-chapter"
    >
      <div class="chapter-title">
        <span class="chapter-num">{{ chapter.order }}</span>
        {{ chapter.title }}
      </div>
      <div class="chapter-sections">
        <div
          v-for="section in chapter.sections"
          :key="section.id"
          class="section-item"
          :class="getSectionClass(section.title)"
        >
          {{ section.title }}
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

function getSectionClass(sectionTitle: string) {
  if (!props.weakPoints?.length) return '';
  const wp = props.weakPoints.find(
    (w) => sectionTitle.includes(w.keyword) || w.keyword.includes(sectionTitle),
  );
  if (!wp) return '';
  return `section-${wp.level}`;
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

.outline-chapter {
  border: 1px solid @color-border;
  border-radius: 8px;
  overflow: hidden;
}

.chapter-title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(26, 58, 110, 0.04);
  font-size: 14px;
  font-weight: 600;
  color: @color-text-primary;
  border-bottom: 1px solid @color-border-light;
}

.chapter-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: @color-primary;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chapter-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 14px;
}

.section-item {
  padding: 4px 10px;
  border-radius: 100px;
  background: @color-bg;
  border: 1px solid @color-border;
  font-size: 13px;
  color: @color-text-secondary;
}

.section-item.section-high {
  background: rgba(255, 77, 79, 0.08);
  border-color: rgba(255, 77, 79, 0.3);
  color: #ff4d4f;
}

.section-item.section-medium {
  background: rgba(212, 160, 23, 0.08);
  border-color: rgba(212, 160, 23, 0.3);
  color: @color-accent-dark;
}

.section-item.section-low {
  background: rgba(82, 196, 26, 0.08);
  border-color: rgba(82, 196, 26, 0.3);
  color: #52c41a;
}
</style>
