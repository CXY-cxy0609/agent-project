<template>
  <div class="chat-sidebar">
    <div class="chat-sidebar-header">
      <span class="sidebar-title">问答中心</span>
      <a-button type="primary" size="small" class="new-chat-btn" @click="$emit('new-chat')">
        <PlusOutlined />
        新对话
      </a-button>
    </div>

    <div class="subject-selector">
      <a-select
        :value="selectedSubjectId ?? undefined"
        placeholder="选择学科"
        style="width: 100%"
        size="small"
        :options="subjectOptions"
        @change="(id: number) => $emit('subject-change', id)"
      >
        <template #notFoundContent>
          <div class="empty-subject">
            <span>暂无学科</span>
            <a-button type="link" size="small" @click="$router.push('/app/subjects')">去添加</a-button>
          </div>
        </template>
      </a-select>
    </div>

    <div class="conv-list-wrap">
      <x-conversations
        :items="conversations"
        :active-key="activeConversationId ?? undefined"
        class="conv-list"
        @active-change="(key: string) => $emit('select-conversation', key)"
      />
      <div v-if="conversations.length === 0" class="conv-empty">
        <CommentOutlined class="conv-empty-icon" />
        <p>暂无对话记录</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PlusOutlined, CommentOutlined } from '@ant-design/icons-vue';
import { Conversations as XConversations } from 'ant-design-x-vue';

interface ConversationItem {
  key: string;
  label: string;
  description?: string;
  timestamp?: number;
}

interface SubjectOption {
  label: string;
  value: number;
}

defineProps<{
  conversations: ConversationItem[];
  activeConversationId: string | null;
  selectedSubjectId: number | null;
  subjectOptions: SubjectOption[];
}>();

defineEmits<{
  'new-chat': [];
  'select-conversation': [key: string];
  'subject-change': [id: number];
}>();
</script>

<style scoped lang="less">
.chat-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid @color-border;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid @color-border;
}

.sidebar-title {
  font-family: @font-serif;
  font-size: 15px;
  font-weight: 600;
  color: @color-text-primary;
}

.new-chat-btn {
  background: @color-primary !important;
  border: none !important;
  border-radius: 6px !important;
  font-size: 12px !important;
}

.subject-selector {
  padding: 10px 12px;
  border-bottom: 1px solid @color-border;
}

.conv-list-wrap {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.conv-list {
  padding: 4px 0;
}

.conv-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: @color-text-muted;
  gap: 8px;
}

.conv-empty-icon {
  font-size: 32px;
  opacity: 0.4;
}

.empty-subject {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: @color-text-muted;
}
</style>
