<template>
  <div class="history-item" @click="$emit('open', conversation.id)">
    <div class="history-item-left">
      <div class="history-item-icon">
        <MessageOutlined />
      </div>
    </div>
    <div class="history-item-main">
      <div class="history-item-title">{{ conversation.title || '新对话' }}</div>
      <div class="history-item-meta">
        <a-tag :color="subjectColor" class="subject-tag">
          {{ conversation.subjectName }}
        </a-tag>
        <span class="meta-item">
          <CalendarOutlined />
          {{ formatDate(conversation.createdAt) }}
        </span>
        <span class="meta-item">
          <MessageOutlined />
          {{ conversation.messageCount }} 条消息
        </span>
      </div>
    </div>
    <div class="history-item-actions">
      <a-button
        type="text"
        size="small"
        :icon="h(ArrowRightOutlined)"
        @click.stop="$emit('open', conversation.id)"
      />
      <a-button
        type="text"
        size="small"
        danger
        :icon="h(DeleteOutlined)"
        @click.stop="$emit('delete', conversation.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue';
import { MessageOutlined, CalendarOutlined, ArrowRightOutlined, DeleteOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import type { Conversation } from '@tutor/shared';

defineProps<{
  conversation: Conversation;
  subjectColor: string;
}>();

defineEmits<{
  open: [id: string];
  delete: [id: string];
}>();

function formatDate(dateStr: string) {
  const d = dayjs(dateStr);
  if (d.isToday()) return d.format('今天 HH:mm');
  if (d.isYesterday()) return d.format('昨天 HH:mm');
  return d.format('YYYY-MM-DD HH:mm');
}
</script>

<style scoped lang="less">
.history-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid @color-border-light;
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:last-child {
  border-bottom: none;
}

.history-item:hover {
  background: rgba(26, 58, 110, 0.03);
}

.history-item-left {
  flex-shrink: 0;
}

.history-item-icon {
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

.history-item-main {
  flex: 1;
  min-width: 0;
}

.history-item-title {
  font-size: 14px;
  font-weight: 500;
  color: @color-text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
}

.history-item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.subject-tag {
  font-size: 12px;
  border-radius: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: @color-text-muted;
}

.history-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.history-item:hover .history-item-actions {
  opacity: 1;
}
</style>
