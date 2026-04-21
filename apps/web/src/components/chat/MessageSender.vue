<template>
  <div class="sender-area">
    <x-attachments
      v-if="attachments.length"
      :items="attachments"
      class="attachment-preview"
      @remove="(uid: string) => $emit('remove-attachment', uid)"
    />

    <x-sender
      v-model:value="localValue"
      :loading="isStreaming"
      :placeholder="senderPlaceholder"
      class="chat-sender"
      @submit="(text: string) => $emit('send', text)"
      @cancel="$emit('cancel')"
    >
      <template #prefix>
        <div class="sender-prefix-btns">
          <a-upload
            :show-upload-list="false"
            :before-upload="handleFileUpload"
            accept=".pdf,.md,image/*"
            multiple
          >
            <a-tooltip title="上传文件/图片">
              <a-button size="small" type="text" :icon="h(PaperClipOutlined)" />
            </a-tooltip>
          </a-upload>

          <a-tooltip :title="generateVideo ? '关闭视频生成' : '生成讲解视频'">
            <a-button
              size="small"
              type="text"
              :class="{ active: generateVideo }"
              :icon="h(VideoCameraOutlined)"
              @click="$emit('update:generateVideo', !generateVideo)"
            />
          </a-tooltip>
        </div>
      </template>

      <template #footer>
        <div class="sender-footer">
          <span class="sender-hint">
            {{ generateVideo ? '将生成配套讲解视频' : 'Enter 发送，Shift+Enter 换行' }}
          </span>
        </div>
      </template>
    </x-sender>
  </div>
</template>

<script setup lang="ts">
import { h, computed } from 'vue';
import { PaperClipOutlined, VideoCameraOutlined } from '@ant-design/icons-vue';
import { Sender as XSender, Attachments as XAttachments } from 'ant-design-x-vue';

interface AttachmentItem {
  uid: string;
  name: string;
  url: string;
  type: string;
}

const props = defineProps<{
  modelValue: string;
  attachments: AttachmentItem[];
  isStreaming: boolean;
  generateVideo: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:generateVideo': [value: boolean];
  'send': [text: string];
  'cancel': [];
  'file-upload': [file: File];
  'remove-attachment': [uid: string];
}>();

const localValue = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const senderPlaceholder = computed(() =>
  props.generateVideo ? '输入知识点，将生成配套视频讲解...' : '输入知识点或题目，按 Enter 发送...',
);

function handleFileUpload(file: File) {
  emit('file-upload', file);
  return false;
}
</script>

<style scoped lang="less">
.sender-area {
  flex-shrink: 0;
  padding: 12px 20px 16px;
  background: #fff;
  border-top: 1px solid @color-border;
}

.attachment-preview {
  margin-bottom: 8px;
}

.chat-sender {
  border-radius: 12px !important;
  border: 1px solid @color-border !important;
  box-shadow: @shadow-sm !important;
  max-width: 800px;
  margin: 0 auto;
}

.sender-prefix-btns {
  display: flex;
  gap: 2px;
}

.sender-prefix-btns :deep(.ant-btn.active) {
  color: @color-accent;
  background: rgba(212, 160, 23, 0.1);
}

.sender-footer {
  padding: 4px 0 0;
}

.sender-hint {
  font-size: 11px;
  color: @color-text-muted;
}
</style>
