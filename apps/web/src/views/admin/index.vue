<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">管理中心</h1>
        <p class="page-desc">系统管理：用户、学科、知识库的全局管理</p>
      </div>
    </div>

    <!-- Stats Overview -->
    <admin-stats-row :stats="overviewStats" />

    <!-- Sub-tabs -->
    <a-tabs v-model:activeKey="activeTab" class="admin-tabs">
      <!-- User Management -->
      <a-tab-pane key="users" tab="用户管理">
        <div class="tab-content">
          <div class="tab-filter-bar">
            <a-input
              v-model:value="userSearch"
              placeholder="搜索用户名或手机号"
              style="width: 240px"
              allow-clear
              :prefix="h(SearchOutlined)"
              @input="loadUsers"
            />
          </div>
          <a-table
            :data-source="users"
            :columns="userColumns"
            :loading="usersLoading"
            row-key="id"
            class="admin-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'role'">
                <a-tag :color="record.role === 'admin' ? 'gold' : 'blue'">
                  {{ record.role === 'admin' ? '管理员' : '学生' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-button
                  v-if="record.role !== 'admin'"
                  size="small"
                  type="text"
                  @click="setAdmin(record.id)"
                >
                  <CrownOutlined /> 设为管理员
                </a-button>
              </template>
            </template>
          </a-table>
        </div>
      </a-tab-pane>

      <!-- Subject Management (Admin) -->
      <a-tab-pane key="subjects" tab="学科管理">
        <div class="tab-content">
          <a-table
            :data-source="adminSubjects"
            :columns="subjectColumns"
            :loading="subjectsLoading"
            row-key="id"
            class="admin-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'actions'">
                <div style="display: flex; gap: 8px; justify-content: center">
                  <a-button size="small" type="text" @click="viewOutline(record)">
                    <UnorderedListOutlined /> 大纲
                  </a-button>
                  <a-popconfirm
                    title="确认删除该学科？用户将无法再搜索到该学科，已添加的用户需手动移除。"
                    ok-text="确认删除"
                    cancel-text="取消"
                    ok-type="danger"
                    @confirm="adminDeleteSubject(record.id)"
                  >
                    <a-button size="small" type="text" danger>
                      <DeleteOutlined /> 删除
                    </a-button>
                  </a-popconfirm>
                </div>
              </template>
            </template>
          </a-table>
        </div>
      </a-tab-pane>

      <!-- Knowledge Base Management (Admin) -->
      <a-tab-pane key="knowledge" tab="知识库管理">
        <div class="tab-content">
          <div class="tab-filter-bar">
            <a-input
              v-model:value="kbSearch"
              placeholder="搜索知识库名称"
              style="width: 200px"
              allow-clear
              :prefix="h(SearchOutlined)"
              @input="loadAdminKbs"
            />
            <a-select
              v-model:value="kbSubjectFilter"
              placeholder="按学科筛选"
              style="width: 160px"
              allow-clear
              :options="adminSubjectOptions"
              @change="loadAdminKbs"
            />
          </div>
          <a-table
            :data-source="adminKbs"
            :columns="kbColumns"
            :loading="kbsLoading"
            row-key="id"
            class="admin-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">
                <a-tag :color="record.type === 'public' ? 'blue' : 'purple'">
                  {{ record.type === 'public' ? '公有' : '私有' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'actions'">
                <a-popconfirm
                  title="确认删除此知识库？"
                  ok-text="删除"
                  cancel-text="取消"
                  ok-type="danger"
                  @confirm="adminDeleteKb(record.id)"
                >
                  <a-button size="small" type="text" danger>
                    <DeleteOutlined /> 删除
                  </a-button>
                </a-popconfirm>
              </template>
            </template>
          </a-table>
        </div>
      </a-tab-pane>
    </a-tabs>

    <!-- Outline View Modal (read-only) -->
    <a-modal
      v-model:open="outlineViewVisible"
      :title="`${viewingSubject?.name} · 大纲（只读）`"
      :footer="null"
      width="600"
    >
      <div class="outline-readonly">
        <outline-tree :outline="viewingOutline" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { message } from 'ant-design-vue';
import {
  SearchOutlined,
  CrownOutlined,
  DeleteOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  BookOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
} from '@ant-design/icons-vue';
import http from '@/api/http';
import { subjectsApi } from '@/api/subjects';
import { knowledgeApi } from '@/api/knowledge';
import AdminStatsRow from '@/components/admin/AdminStatsRow.vue';
import OutlineTree from '@/components/common/OutlineTree.vue';
import type { User, Subject, KnowledgeBase, SubjectOutline } from '@kaoyan/shared';

const activeTab = ref('users');

const overviewStats = ref([
  { label: '注册用户', value: '—', icon: TeamOutlined, bg: 'linear-gradient(135deg,#e8f0fe,#c7d7fc)' },
  { label: '学科总数', value: '—', icon: AppstoreOutlined, bg: 'linear-gradient(135deg,#fff8e8,#fde8b0)' },
  { label: '知识库总数', value: '—', icon: DatabaseOutlined, bg: 'linear-gradient(135deg,#e8fef0,#b0f0cc)' },
  { label: '对话总量', value: '—', icon: BookOutlined, bg: 'linear-gradient(135deg,#fef0f8,#f0b0d8)' },
]);

const users = ref<User[]>([]);
const usersLoading = ref(false);
const userSearch = ref('');

const userColumns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '用户 ID', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
  { title: '操作', key: 'actions', width: 160, align: 'center' as const },
];

const adminSubjects = ref<Subject[]>([]);
const subjectsLoading = ref(false);

const subjectColumns = [
  { title: '学科 ID', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: '学科名称', dataIndex: 'name', key: 'name' },
  { title: '学科编号', dataIndex: 'code', key: 'code', width: 120 },
  { title: '说明', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '操作', key: 'actions', width: 160, align: 'center' as const },
];

const adminSubjectOptions = computed(() =>
  adminSubjects.value.map((s) => ({ label: s.name, value: s.id })),
);

const adminKbs = ref<KnowledgeBase[]>([]);
const kbsLoading = ref(false);
const kbSearch = ref('');
const kbSubjectFilter = ref<string | undefined>();

const kbColumns = [
  { title: '知识库名称', dataIndex: 'name', key: 'name' },
  { title: '学科', dataIndex: 'subjectName', key: 'subjectName', width: 120 },
  { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
  { title: '文件数', key: 'fileCount', customRender: ({ record }: { record: KnowledgeBase }) => record.files.length, width: 80 },
  { title: '操作', key: 'actions', width: 100, align: 'center' as const },
];

const outlineViewVisible = ref(false);
const viewingSubject = ref<Subject | null>(null);
const viewingOutline = ref<SubjectOutline>({ chapters: [] });

async function loadUsers() {
  usersLoading.value = true;
  try {
    const result = await http.get<User[], User[]>('/admin/users', {
      params: { search: userSearch.value || undefined },
    });
    users.value = result;
  } finally {
    usersLoading.value = false;
  }
}

async function setAdmin(userId: string) {
  await http.put(`/admin/users/${userId}/role`, { role: 'admin' });
  message.success('已设置为管理员');
  loadUsers();
}

async function loadAdminSubjects() {
  subjectsLoading.value = true;
  try {
    adminSubjects.value = await subjectsApi.adminGetAll();
  } finally {
    subjectsLoading.value = false;
  }
}

async function adminDeleteSubject(id: string) {
  await subjectsApi.adminDeleteSubject(id);
  message.success('已删除');
  loadAdminSubjects();
}

async function viewOutline(subject: Subject) {
  viewingSubject.value = subject;
  outlineViewVisible.value = true;
  try {
    viewingOutline.value = await subjectsApi.getOutline(subject.id);
  } catch {
    viewingOutline.value = { chapters: [] };
  }
}

async function loadAdminKbs() {
  kbsLoading.value = true;
  try {
    adminKbs.value = await knowledgeApi.getKnowledgeBases({
      name: kbSearch.value || undefined,
      subjectId: kbSubjectFilter.value,
    });
  } finally {
    kbsLoading.value = false;
  }
}

async function adminDeleteKb(id: string) {
  await knowledgeApi.deleteKnowledgeBase(id);
  message.success('已删除');
  loadAdminKbs();
}

onMounted(() => {
  loadUsers();
  loadAdminSubjects();
  loadAdminKbs();
});
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
}

.page-header {
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

.admin-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.tab-content {
  background: #fff;
  border-radius: 0 @radius-lg @radius-lg @radius-lg;
  border: 1px solid @color-border;
  overflow: hidden;
  box-shadow: @shadow-sm;
}

.tab-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid @color-border-light;
}

.admin-table {
  padding: 0;
}

:deep(.ant-table-thead > tr > th) {
  background: rgba(26, 58, 110, 0.04) !important;
  font-weight: 600;
  color: @color-text-primary;
}

.outline-readonly {
  max-height: 480px;
  overflow-y: auto;
}
</style>
