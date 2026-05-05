<template>
  <div class="chat-right-panel" :class="{ collapsed }">
    <div class="right-panel-toggle" @click="$emit('update:collapsed', !collapsed)">
      <LeftOutlined v-if="!collapsed" />
      <RightOutlined v-else />
    </div>

    <template v-if="!collapsed">
      <div class="right-panel-header">
        <span>学情速览</span>
      </div>

      <div class="right-panel-content">
        <div v-if="activeSubject" class="subject-info-card">
          <div class="sic-title">{{ activeSubject.name }}</div>
          <div class="sic-code">{{ activeSubject.code }}</div>
        </div>

        <div class="right-panel-section">
          <div class="rps-title">近期薄弱点</div>
          <div class="weak-tags">
            <a-tag
              v-for="wp in weakPoints"
              :key="wp.text"
              :color="wp.color"
              class="weak-tag"
            >
              {{ wp.text }}
            </a-tag>
          </div>
        </div>

        <div class="right-panel-section">
          <div class="rps-title">快捷操作</div>
          <div class="quick-actions">
            <a-button block size="small" @click="$router.push('/app/analytics')">
              <BarChartOutlined /> 查看学情分析
            </a-button>
            <a-button block size="small" @click="$router.push('/app/knowledge')">
              <BookOutlined /> 查看知识库
            </a-button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { LeftOutlined, RightOutlined, BarChartOutlined, BookOutlined } from '@ant-design/icons-vue';

interface Subject {
  name: string;
  code: number;
}

interface WeakPoint {
  text: string;
  color: string;
}

defineProps<{
  collapsed: boolean;
  activeSubject?: Subject;
  weakPoints: WeakPoint[];
}>();

defineEmits<{
  'update:collapsed': [value: boolean];
}>();
</script>

<style scoped lang="less">
.chat-right-panel {
  width: 220px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid @color-border;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease;
  position: relative;
}

.chat-right-panel.collapsed {
  width: 28px;
}

.right-panel-toggle {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  width: 22px;
  height: 48px;
  background: @color-border;
  border-radius: 0 6px 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  color: @color-text-muted;
  transition: background 0.2s;
  z-index: 1;
}

.right-panel-toggle:hover {
  background: @color-primary;
  color: #fff;
}

.right-panel-header {
  padding: 14px 16px 14px 28px;
  font-size: 13px;
  font-weight: 600;
  color: @color-text-primary;
  border-bottom: 1px solid @color-border;
}

.right-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.subject-info-card {
  padding: 12px;
  background: rgba(26, 58, 110, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(26, 58, 110, 0.08);
}

.sic-title {
  font-size: 14px;
  font-weight: 600;
  color: @color-primary;
}

.sic-code {
  font-size: 12px;
  color: @color-text-muted;
  margin-top: 2px;
}

.right-panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rps-title {
  font-size: 12px;
  font-weight: 600;
  color: @color-text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.weak-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.weak-tag {
  font-size: 12px;
  border-radius: 4px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
