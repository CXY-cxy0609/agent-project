<template>
  <a-row :gutter="[16, 16]" class="stats-row">
    <a-col :span="6" v-for="stat in stats" :key="stat.label">
      <div class="stat-card">
        <div class="stat-card-icon" :style="{ background: stat.bg }">
          <component :is="stat.icon" />
        </div>
        <div class="stat-card-info">
          <div class="stat-card-num">{{ stat.value }}</div>
          <div class="stat-card-label">{{ stat.label }}</div>
        </div>
      </div>
    </a-col>
  </a-row>
</template>

<script setup lang="ts">
import type { Component } from 'vue';

interface StatItem {
  label: string;
  value: string | number;
  icon: Component;
  bg: string;
}

defineProps<{
  stats: StatItem[];
}>();
</script>

<style scoped lang="less">
.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: @radius-lg;
  border: 1px solid @color-border;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: @shadow-sm;
}

.stat-card-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: @color-primary;
  flex-shrink: 0;
}

.stat-card-num {
  font-family: @font-serif;
  font-size: 28px;
  font-weight: 700;
  color: @color-text-primary;
  line-height: 1;
}

.stat-card-label {
  font-size: 13px;
  color: @color-text-muted;
  margin-top: 4px;
}
</style>
