<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">知识库</h1>
        <p class="page-desc">管理各学科知识库，上传 PDF/MD 文档，AI 检索增强对话</p>
      </div>
    </div>

    <!-- Subject Tabs -->
    <a-tabs
      v-model:activeKey="activeSubjectId"
      class="subject-tabs"
      type="card"
      @change="loadKnowledgeBases"
    >
      <template #tabBarExtraContent>
        <div style="display: flex; gap: 8px; align-items: center; padding-right: 8px">
          <a-select
            v-model:value="typeFilter"
            size="small"
            style="width: 120px"
            @change="loadKnowledgeBases"
          >
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="public">公有知识库</a-select-option>
            <a-select-option value="private">私有知识库</a-select-option>
          </a-select>
          <a-input
            v-model:value="searchName"
            size="small"
            placeholder="搜索知识库"
            allow-clear
            style="width: 160px"
            :prefix="h(SearchOutlined)"
            @change="loadKnowledgeBases"
          />
          <a-button type="primary" size="small" @click="openCreateModal">
            <PlusOutlined /> 新建知识库
          </a-button>
        </div>
      </template>
      <a-tab-pane
        v-for="subject in subjectStore.subjects"
        :key="subject.id"
        :tab="subject.name"
      />
    </a-tabs>

    <!-- Knowledge Base Grid -->
    <a-spin :spinning="loading">
      <div v-if="knowledgeBases.length === 0 && !loading" class="kb-empty">
        <a-empty description="该学科下暂无知识库，点击「新建知识库」创建" />
      </div>
      <div v-else class="kb-grid">
        <kb-card
          v-for="kb in knowledgeBases"
          :key="kb.id"
          :kb="kb"
          @view="openKbDetail"
          @edit="openEditModal"
          @delete="deleteKb"
        />
      </div>
    </a-spin>

    <!-- Create/Edit Modal -->
    <kb-form-modal
      v-model:open="modalVisible"
      :editing-kb="editingKb"
      :subject-name="activeSubjectName"
      :saving="saving"
      @save="saveKb"
    />

    <!-- Knowledge Base Detail Drawer -->
    <kb-detail-drawer
      v-model:open="drawerVisible"
      :kb="selectedKb"
      :uploading="uploading"
      @upload="uploadFile"
      @reorder="onFileReorder"
      @save-md="saveMdContent"
      @rename="renameFile"
      @delete-file="deleteFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { knowledgeApi } from '@/api/knowledge';
import { subjectsApi } from '@/api/subjects';
import { useSubjectStore } from '@/stores/subject';
import KbCard from '@/components/knowledge/KbCard.vue';
import KbFormModal from '@/components/knowledge/KbFormModal.vue';
import KbDetailDrawer from '@/components/knowledge/KbDetailDrawer.vue';
import type { KnowledgeBase } from '@tutor/shared';

const subjectStore = useSubjectStore();

const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);

const activeSubjectId = ref<string>('');
const typeFilter = ref('');
const searchName = ref('');
const knowledgeBases = ref<KnowledgeBase[]>([]);
const selectedKb = ref<KnowledgeBase | null>(null);

const modalVisible = ref(false);
const drawerVisible = ref(false);
const editingKb = ref<KnowledgeBase | null>(null);

const activeSubjectName = computed(
  () => subjectStore.subjects.find((s) => s.id === activeSubjectId.value)?.name ?? '',
);

async function loadKnowledgeBases() {
  if (!activeSubjectId.value) return;
  loading.value = true;
  try {
    const params: Parameters<typeof knowledgeApi.getKnowledgeBases>[0] = {
      subjectId: activeSubjectId.value,
    };
    if (typeFilter.value) params.type = typeFilter.value as 'public' | 'private';
    if (searchName.value) params.name = searchName.value;
    knowledgeBases.value = await knowledgeApi.getKnowledgeBases(params);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingKb.value = null;
  modalVisible.value = true;
}

function openEditModal(kb: KnowledgeBase) {
  editingKb.value = kb;
  modalVisible.value = true;
}

async function saveKb(data: { name: string; type: 'public' | 'private'; description: string }) {
  if (!data.name.trim()) {
    message.warning('请输入知识库名称');
    return;
  }
  saving.value = true;
  try {
    if (editingKb.value) {
      await knowledgeApi.updateKnowledgeBase(editingKb.value.id, data);
      message.success('更新成功');
    } else {
      await knowledgeApi.createKnowledgeBase({ ...data, subjectId: activeSubjectId.value });
      message.success('创建成功');
    }
    modalVisible.value = false;
    loadKnowledgeBases();
  } finally {
    saving.value = false;
  }
}

function openKbDetail(kb: KnowledgeBase) {
  selectedKb.value = { ...kb, files: [...kb.files] };
  drawerVisible.value = true;
}

function deleteKb(id: string) {
  Modal.confirm({
    title: '确认删除',
    content: '删除知识库及其所有文件，确认删除？',
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    async onOk() {
      await knowledgeApi.deleteKnowledgeBase(id);
      message.success('删除成功');
      loadKnowledgeBases();
    },
  });
}

async function uploadFile(file: File) {
  if (!selectedKb.value) return;
  uploading.value = true;
  try {
    const newFile = await knowledgeApi.uploadFile(selectedKb.value.id, file);
    selectedKb.value.files.push(newFile);
    message.success('上传成功');
  } finally {
    uploading.value = false;
  }
}

async function saveMdContent(fileId: string, content: string) {
  if (!selectedKb.value) return;
  await knowledgeApi.updateFile(selectedKb.value.id, fileId, { content });
  const file = selectedKb.value.files.find((f) => f.id === fileId);
  if (file) file.content = content;
  message.success('保存成功');
}

async function renameFile(fileId: string, displayName: string) {
  if (!selectedKb.value) return;
  await knowledgeApi.updateFile(selectedKb.value.id, fileId, { displayName });
  const file = selectedKb.value.files.find((f) => f.id === fileId);
  if (file) file.displayName = displayName;
  message.success('重命名成功');
}

async function deleteFile(fileId: string) {
  if (!selectedKb.value) return;
  Modal.confirm({
    title: '确认删除文件？',
    okType: 'danger',
    okText: '删除',
    cancelText: '取消',
    async onOk() {
      if (!selectedKb.value) return;
      await knowledgeApi.deleteFile(selectedKb.value.id, fileId);
      selectedKb.value!.files = selectedKb.value!.files.filter((f) => f.id !== fileId);
      message.success('删除成功');
    },
  });
}

async function onFileReorder(fileIds: string[]) {
  if (!selectedKb.value) return;
  await knowledgeApi.reorderFiles(selectedKb.value.id, fileIds).catch(() => {});
}

onMounted(async () => {
  await subjectsApi.getMySubjects().then((list) => subjectStore.setSubjects(list)).catch(() => {});
  if (subjectStore.subjects.length > 0) {
    activeSubjectId.value = subjectStore.activeSubjectId || subjectStore.subjects[0].id;
    loadKnowledgeBases();
  }
});
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-family: @font-serif;
  font-size: 24px;
  font-weight: 700;
  color: @color-text-primary;
  margin: 0;
}

.page-desc {
  font-size: 14px;
  color: @color-text-muted;
  margin: 4px 0 0;
}

.subject-tabs {
  margin-bottom: 20px;
}

:deep(.ant-tabs-card .ant-tabs-tab-active) {
  background: @color-primary !important;
  border-color: @color-primary !important;
}

:deep(.ant-tabs-card .ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #fff !important;
}

.kb-empty {
  padding: 60px 0;
  background: #fff;
  border-radius: @radius-lg;
  border: 1px solid @color-border;
}

.kb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>
