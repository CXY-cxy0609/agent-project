<template>
  <div class="chat-header">
    <div class="chat-header-title">
      {{ title || '新对话' }}
    </div>
    <div class="chat-header-actions">
      <a-select
        :value="selectedModel"
        size="small"
        style="width: 160px"
        :options="modelOptions"
        @change="(v: string) => $emit('update:selectedModel', v)"
      />
      <a-tooltip title="删除对话">
        <a-button
          size="small"
          danger
          :icon="h(DeleteOutlined)"
          @click="$emit('delete')"
        />
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue';
import { DeleteOutlined } from '@ant-design/icons-vue';

interface ModelOption {
  label: string;
  value: string;
}

defineProps<{
  title?: string;
  selectedModel: string;
  modelOptions: ModelOption[];
}>();

defineEmits<{
  'update:selectedModel': [value: string];
  'delete': [];
}>();
</script>

<style scoped lang="less">
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid @color-border;
  flex-shrink: 0;
}

.chat-header-title {
  font-size: 14px;
  font-weight: 500;
  color: @color-text-primary;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
