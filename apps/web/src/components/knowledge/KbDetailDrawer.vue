<template>
  <a-drawer
    :open="open"
    :title="kb?.name"
    width="680"
    :body-style="{ padding: '16px 24px' }"
    @close="$emit('update:open', false)"
  >
    <template #extra>
      <a-upload
        :show-upload-list="false"
        :before-upload="handleUpload"
        accept=".pdf,.md,.markdown,.txt,.docx,.pptx,.xlsx,.csv,.html,.htm"
        :disabled="uploading"
      >
        <a-button type="primary" size="small" :loading="uploading">
          <UploadOutlined /> 上传文档
        </a-button>
      </a-upload>
    </template>

    <div class="drawer-upload-hint">支持 PDF、Markdown、Office、CSV、HTML 格式，拖拽可调整顺序</div>

    <div v-if="kb" class="file-list">
      <div v-for="file in localFiles" :key="file.id" class="file-item">
        <div class="drag-handle">
          <HolderOutlined />
        </div>
        <div class="file-icon">
          <FilePdfOutlined v-if="file.type === 'pdf'" class="pdf-icon" />
          <FileMarkdownOutlined v-else-if="file.type === 'md'" class="md-icon" />
          <FileTextOutlined v-else class="file-generic-icon" />
        </div>
        <div class="file-info">
          <div class="file-name">{{ file.displayName || file.name }}</div>
          <div class="file-size">
            {{ formatFileSize(file.size) }}
            <span v-if="file.status" class="file-status"> · {{ file.status }}</span>
          </div>
        </div>
        <div class="file-actions">
          <a-tooltip title="下载">
            <a-button size="small" type="text" :disabled="!file.url" @click="downloadFile(file)">
              <DownloadOutlined />
            </a-button>
          </a-tooltip>
          <a-tooltip title="重命名">
            <a-button size="small" type="text" @click="openRename(file)">
              <TagOutlined />
            </a-button>
          </a-tooltip>
          <a-tooltip title="删除">
            <a-button size="small" type="text" danger @click="$emit('delete-file', file.id)">
              <DeleteOutlined />
            </a-button>
          </a-tooltip>
        </div>
      </div>

      <div v-if="localFiles.length === 0" class="file-empty">
        <a-empty description="暂无文件，点击「上传文档」添加" />
      </div>
    </div>

    <!-- Rename Modal -->
    <a-modal
      v-model:open="renameVisible"
      title="重命名文件"
      ok-text="确认"
      cancel-text="取消"
      :ok-loading="renameSaving"
      @ok="confirmRename"
    >
      <a-input
        v-model:value="renameValue"
        placeholder="输入文件显示名称"
        style="margin-top: 8px"
      />
    </a-modal>
  </a-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  UploadOutlined,
  HolderOutlined,
  FilePdfOutlined,
  FileMarkdownOutlined,
  FileTextOutlined,
  DownloadOutlined,
  TagOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue';
import type { KnowledgeBase, KnowledgeFile } from '@tutor/shared';

const props = defineProps<{
  open: boolean;
  kb: KnowledgeBase | null;
  uploading: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  upload: [file: File];
  reorder: [fileIds: string[]];
  rename: [fileId: string, displayName: string];
  'delete-file': [fileId: string];
}>();

const localFiles = computed({
  get: () => props.kb?.files ?? [],
  set: () => {},
});

const renameVisible = ref(false);
const editingFile = ref<KnowledgeFile | null>(null);
const renameValue = ref('');
const renameSaving = ref(false);

watch(() => props.open, (val) => {
  if (!val) {
    renameVisible.value = false;
  }
});

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function handleUpload(file: File) {
  emit('upload', file);
  return false;
}

function downloadFile(file: KnowledgeFile) {
  if (!file.url) return;
  const link = document.createElement('a');
  link.href = file.url;
  link.download = file.displayName || file.name;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openRename(file: KnowledgeFile) {
  editingFile.value = file;
  renameValue.value = file.displayName || file.name;
  renameVisible.value = true;
}

async function confirmRename() {
  if (!editingFile.value) return;
  renameSaving.value = true;
  try {
    emit('rename', editingFile.value.id, renameValue.value);
    renameVisible.value = false;
  } finally {
    renameSaving.value = false;
  }
}
</script>

<style scoped lang="less">
.drawer-upload-hint {
  font-size: 12px;
  color: @color-text-muted;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: rgba(26, 58, 110, 0.04);
  border-radius: 6px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-empty {
  padding: 40px 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: @color-bg;
  border: 1px solid @color-border;
  border-radius: 8px;
  transition: background 0.15s;
}

.file-item:hover {
  background: rgba(26, 58, 110, 0.03);
}

.drag-handle {
  cursor: grab;
  color: @color-text-muted;
  font-size: 16px;
  flex-shrink: 0;
}

.drag-handle:active {
  cursor: grabbing;
}

.file-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.pdf-icon {
  color: #ff4d4f;
}

.md-icon {
  color: @color-primary;
}

.file-generic-icon {
  color: @color-text-secondary;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: @color-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: @color-text-muted;
  margin-top: 2px;
}

.file-status {
  color: #52c41a;
}

.file-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
