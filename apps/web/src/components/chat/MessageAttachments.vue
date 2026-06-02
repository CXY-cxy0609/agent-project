<template>
  <div v-if="attachments.length" class="message-attachments">
    <div v-if="imageAttachments.length" class="image-grid">
      <a-image
        v-for="item in imageAttachments"
        :key="item.id"
        :src="item.thumbnailUrl || item.url"
        :preview="{ src: item.url }"
        class="image-item"
      />
    </div>

    <div v-if="fileAttachments.length" class="file-list">
      <a
        v-for="item in fileAttachments"
        :key="item.id"
        class="file-card"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <file-pdf-outlined v-if="item.type === 'pdf'" class="file-icon" />
        <file-text-outlined v-else class="file-icon" />
        <span class="file-info">
          <span class="file-name">{{ item.name }}</span>
          <span class="file-size">{{ formatFileSize(item.size) }}</span>
        </span>
        <download-outlined class="download-icon" />
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DownloadOutlined, FilePdfOutlined, FileTextOutlined } from '@ant-design/icons-vue';
import type { MessageAttachment } from '@tutor/shared';

const props = defineProps<{
  attachments?: MessageAttachment[];
}>();

const attachments = computed(() => props.attachments ?? []);
const imageAttachments = computed(() => attachments.value.filter((item) => item.type === 'image'));
const fileAttachments = computed(() => attachments.value.filter((item) => item.type !== 'image'));

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '未知大小';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<style scoped lang="less">
.message-attachments {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  max-width: 360px;
}

.image-grid :deep(.ant-image) {
  width: 100%;
}

.image-item {
  width: 100%;
  height: 96px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid @color-border;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 240px;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: #1f2a3d;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid @color-border;
  border-radius: 8px;
  text-decoration: none;
}

.file-card:hover {
  color: @color-accent;
  border-color: @color-accent;
}

.file-icon {
  flex-shrink: 0;
  font-size: 18px;
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: @color-text-muted;
}

.download-icon {
  flex-shrink: 0;
  color: @color-text-muted;
}
</style>
