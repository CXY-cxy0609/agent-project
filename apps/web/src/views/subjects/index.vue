<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">学科管理</h1>
        <p class="page-desc">管理您的学习学科，设置学科大纲，组织复习结构</p>
      </div>
      <div class="page-header-actions">
        <a-button @click="searchModalVisible = true">
          <SearchOutlined /> 添加已有学科
        </a-button>
        <a-button type="primary" @click="openCreateModal">
          <PlusOutlined /> 新建一级学科
        </a-button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="subjects.length === 0 && !loading" class="subjects-empty">
      <a-result
        status="info"
        title="请添加学科"
        sub-title="您还没有任何学科，请先新建学科或搜索添加已有学科"
      >
        <template #extra>
          <a-button @click="searchModalVisible = true">搜索已有学科</a-button>
          <a-button type="primary" @click="openCreateModal" style="margin-left: 8px">新建一级学科</a-button>
        </template>
      </a-result>
    </div>

    <!-- Subjects Table -->
    <div v-else class="subjects-table-wrap">
      <a-table
        :data-source="tableSubjects"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :pagination="false"
        :expandable="expandableConfig"
        :row-class-name="rowClassName"
        class="subjects-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span class="subject-name">{{ record.name }}</span>
          </template>
          <template v-if="column.key === 'actions'">
            <div class="table-actions">
              <a-button
                v-if="record.level === 1"
                size="small"
                type="text"
                @click="openCreateChildModal(record)"
              >
                <PlusOutlined /> 子学科
              </a-button>
              <a-button size="small" type="text" @click="openOutlineModal(record)">
                <UnorderedListOutlined /> 大纲
              </a-button>
              <a-button size="small" type="text" @click="openEditModal(record)">
                <EditOutlined /> 编辑
              </a-button>
              <a-popconfirm
                title="确认移除该学科？（不会删除知识库数据）"
                ok-text="确认"
                cancel-text="取消"
                ok-type="danger"
                @confirm="removeSubject(record.id)"
              >
                <a-button size="small" type="text" danger>
                  <DeleteOutlined /> 移除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- Modals -->
    <subject-form-modal
      v-model:open="formModalVisible"
      :editing-subject="editingSubject"
      :creating-parent-subject="creatingParentSubject"
      :saving="saving"
      @save="saveSubject"
    />

    <subject-search-modal
      v-model:open="searchModalVisible"
      @added="loadSubjects"
    />

    <subject-outline-modal
      v-model:open="outlineModalVisible"
      :subject="outlineSubject"
      :saving-outline="savingOutline"
      :initial-outline="currentOutline"
      @save="saveOutline"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue';
import { subjectsApi } from '@/api/subjects';
import { useSubjectStore } from '@/stores/subject';
import SubjectFormModal from '@/components/subjects/SubjectFormModal.vue';
import SubjectSearchModal from '@/components/subjects/SubjectSearchModal.vue';
import SubjectOutlineModal from '@/components/subjects/SubjectOutlineModal.vue';
import type { UserSubject, SubjectOutline, SubjectLevel } from '@tutor/shared';

const subjectStore = useSubjectStore();

const loading = ref(false);
const saving = ref(false);
const savingOutline = ref(false);

const subjects = ref<UserSubject[]>([]);
const formModalVisible = ref(false);
const searchModalVisible = ref(false);
const outlineModalVisible = ref(false);

const editingSubject = ref<UserSubject | null>(null);
const creatingParentSubject = ref<UserSubject | null>(null);
const outlineSubject = ref<UserSubject | null>(null);
const currentOutline = ref<SubjectOutline>({ modules: [] });
type SubjectTreeNode = UserSubject & { children?: UserSubject[] };

const tableSubjects = computed<SubjectTreeNode[]>(() => {
  const roots = subjects.value
    .filter((subject) => subject.level === 1)
    .sort((a, b) => a.code - b.code);

  const childrenByParent = new Map<number, UserSubject[]>();
  subjects.value
    .filter((subject) => subject.level === 2 && subject.parentId)
    .forEach((subject) => {
      const parentId = subject.parentId as number;
      const children = childrenByParent.get(parentId) ?? [];
      children.push(subject);
      childrenByParent.set(parentId, children);
    });

  return roots.map((root) => ({
    ...root,
    children: (childrenByParent.get(root.id) ?? []).sort((a, b) => a.code - b.code),
  }));
});

const expandableConfig = computed(() => ({
  defaultExpandAllRows: true,
  childrenColumnName: 'children',
  rowExpandable: (record: SubjectTreeNode) => !!record.children?.length,
}));

function rowClassName(record: UserSubject) {
  return record.level === 2 ? 'subject-row-child' : 'subject-row-root';
}

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 90, ellipsis: true },
  { title: '学科名称', dataIndex: 'name', key: 'name', width: 280, ellipsis: true },
  {
    title: '层级',
    key: 'level',
    width: 100,
    customRender: ({ record }: { record: UserSubject }) => (record.level === 1 ? '一级学科' : '二级学科'),
  },
  { title: '学科编号', dataIndex: 'code', key: 'code', width: 110 },
  { title: '说明', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '操作', key: 'actions', width: 260 },
];

async function loadSubjects() {
  loading.value = true;
  try {
    const list = await subjectsApi.getMySubjects();
    const normalized: UserSubject[] = list
      .map((subject) => ({
        ...subject,
        level: (subject.parentId ? 2 : 1) as SubjectLevel,
      }))
      .sort((a, b) => a.code - b.code);
    subjects.value = normalized;
    subjectStore.setSubjects(normalized);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingSubject.value = null;
  creatingParentSubject.value = null;
  formModalVisible.value = true;
}

function openCreateChildModal(parent: UserSubject) {
  creatingParentSubject.value = parent;
  editingSubject.value = null;
  formModalVisible.value = true;
}

function openEditModal(subject: UserSubject) {
  creatingParentSubject.value = null;
  editingSubject.value = subject;
  formModalVisible.value = true;
}

async function saveSubject(data: { name: string; code: number | null; parentId: number | null; description: string }) {
  if (!data.name || data.code === null) {
    message.warning('学科名称和编号为必填项');
    return;
  }
  const payload = {
    name: data.name.trim(),
    code: data.code,
    parentId: editingSubject.value
      ? editingSubject.value.parentId
      : (creatingParentSubject.value?.id ?? null),
    description: data.description.trim(),
  };

  saving.value = true;
  try {
    if (editingSubject.value) {
      await subjectsApi.updateSubject(editingSubject.value.id, payload);
      message.success('更新成功');
    } else {
      await subjectsApi.createSubject(payload);
      message.success('创建成功');
    }
    formModalVisible.value = false;
    loadSubjects();
  } finally {
    saving.value = false;
  }
}

async function removeSubject(id: number) {
  await subjectsApi.removeMySubject(id);
  message.success('已移除');
  loadSubjects();
}

async function openOutlineModal(subject: UserSubject) {
  outlineSubject.value = subject;
  currentOutline.value = { modules: [] };
  outlineModalVisible.value = true;
  try {
    const result = await subjectsApi.getOutline(subject.id);
    currentOutline.value = result ?? { modules: [] };
  } catch {
    currentOutline.value = { modules: [] };
  }
}

async function saveOutline(outline: SubjectOutline) {
  if (!outlineSubject.value) return;
  savingOutline.value = true;
  try {
    await subjectsApi.updateOutline(outlineSubject.value.id, outline);
    message.success('大纲已保存');
    outlineModalVisible.value = false;
  } finally {
    savingOutline.value = false;
  }
}

onMounted(loadSubjects);
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
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

.page-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.subjects-empty {
  margin-top: 60px;
}

.subjects-table-wrap {
  background: #fff;
  border-radius: @radius-lg;
  border: 1px solid @color-border;
  overflow: hidden;
  box-shadow: @shadow-sm;
  overflow-x: auto;
}

.subjects-table {
  width: 100%;
  min-width: 920px;
}

:deep(.ant-table-thead > tr > th) {
  background: rgba(26, 58, 110, 0.04) !important;
  font-weight: 600;
  color: @color-text-primary;
}

.subject-name {
  font-weight: 500;
  color: @color-text-primary;
}

.table-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 6px;
}

:deep(.subject-row-child td) {
  background: rgba(26, 58, 110, 0.02);
}

:deep(.ant-table-row-expand-icon) {
  border-radius: 6px;
}

:deep(.ant-table-row-expand-icon-cell) {
  width: 44px;
}

:deep(.ant-table-cell) {
  vertical-align: middle;
}

@media (max-width: 1280px) {
  .page-container {
    padding: 20px;
  }

  .page-header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
