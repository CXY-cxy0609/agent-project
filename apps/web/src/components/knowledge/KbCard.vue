<template>
  <div class="kb-card" @click="$emit('view', kb)">
    <div class="kb-card-header">
      <div class="kb-icon">
        <LockOutlined v-if="kb.type === 'private'" />
        <GlobalOutlined v-else />
      </div>
      <a-tag :color="kb.type === 'public' ? 'blue' : 'purple'" class="kb-type-tag">
        {{ kb.type === 'public' ? '公有' : '私有' }}
      </a-tag>
    </div>

    <div class="kb-name">{{ kb.name }}</div>
    <div class="kb-desc">{{ kb.description || '暂无描述' }}</div>

    <div class="kb-meta">
      <span><FileOutlined /> {{ kb.files.length }} 个文件</span>
      <span><CalendarOutlined /> {{ formatDate(kb.updatedAt) }}</span>
    </div>

    <div class="kb-actions" @click.stop>
      <a-button size="small" type="text" @click="$emit('view', kb)">
        <FolderOpenOutlined /> 查看
      </a-button>
      <a-button size="small" type="text" @click="$emit('edit', kb)">
        <EditOutlined />
      </a-button>
      <a-button size="small" type="text" danger @click="$emit('delete', kb.id)">
        <DeleteOutlined />
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  LockOutlined,
  GlobalOutlined,
  FileOutlined,
  CalendarOutlined,
  FolderOpenOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { KnowledgeBase } from '@tutor/shared';

defineProps<{
  kb: KnowledgeBase;
}>();

defineEmits<{
  view: [kb: KnowledgeBase];
  edit: [kb: KnowledgeBase];
  delete: [id: string];
}>();

function formatDate(s: string) {
  return dayjs(s).format('MM-DD');
}
</script>

<style scoped lang="less">
.kb-card {
  background: #fff;
  border-radius: @radius-lg;
  padding: 20px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kb-card:hover {
  box-shadow: @shadow-md;
  border-color: @color-primary;
  transform: translateY(-2px);
}

.kb-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kb-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(26, 58, 110, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: @color-primary;
}

.kb-name {
  font-size: 15px;
  font-weight: 600;
  color: @color-text-primary;
}

.kb-desc {
  font-size: 13px;
  color: @color-text-muted;
  flex: 1;
}

.kb-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: @color-text-muted;
}

.kb-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.kb-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid @color-border-light;
}
</style>
