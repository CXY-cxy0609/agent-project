<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">问答历史</h1>
        <p class="page-desc">查看和搜索所有历史对话记录</p>
      </div>
    </div>

    <history-filter :subject-options="subjectOptions" @change="handleFilterChange" />

    <div class="history-content">
      <div class="history-summary">
        共 <strong>{{ total }}</strong> 条记录
      </div>

      <a-spin :spinning="loading">
        <div v-if="conversations.length === 0 && !loading" class="history-empty">
          <a-empty description="暂无对话记录" />
        </div>
        <div v-else class="history-list">
          <history-item
            v-for="conv in conversations"
            :key="conv.id"
            :conversation="conv"
            :subject-color="subjectColor(conv.subjectId)"
            @open="openConversation"
            @delete="deleteConversation"
          />
        </div>
      </a-spin>

      <div v-if="total > pageSize" class="history-pagination">
        <a-pagination
          v-model:current="page"
          :total="total"
          :page-size="pageSize"
          show-quick-jumper
          :show-total="(t: number) => `共 ${t} 条`"
          @change="loadHistory"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { message, Modal } from 'ant-design-vue';
import dayjs from 'dayjs';
import { chatApi } from '@/api/chat';
import { subjectsApi } from '@/api/subjects';
import { useSubjectStore } from '@/stores/subject';
import { useChatStore } from '@/stores/chat';
import HistoryFilter from '@/components/history/HistoryFilter.vue';
import HistoryItem from '@/components/history/HistoryItem.vue';
import type { Conversation } from '@tutor/shared';

const router = useRouter();
const subjectStore = useSubjectStore();
const chatStore = useChatStore();

const loading = ref(false);
const conversations = ref<Conversation[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 15;

const activeFilters = ref<{
  title?: string;
  subjectId?: string;
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs] | null;
  knowledgeKeyword?: string;
}>({});

const subjectOptions = computed(() =>
  subjectStore.subjects.map((s) => ({ label: s.name, value: s.id })),
);

const subjectColorMap: Record<string, string> = {};
const colorPalette = ['blue', 'purple', 'cyan', 'geekblue', 'magenta', 'volcano'];

function subjectColor(subjectId: string) {
  if (!subjectColorMap[subjectId]) {
    const idx = Object.keys(subjectColorMap).length % colorPalette.length;
    subjectColorMap[subjectId] = colorPalette[idx];
  }
  return subjectColorMap[subjectId];
}

async function loadHistory() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize };
    if (activeFilters.value.title) params.title = activeFilters.value.title;
    if (activeFilters.value.subjectId) params.subjectId = activeFilters.value.subjectId;
    if (activeFilters.value.dateRange) {
      params.startDate = activeFilters.value.dateRange[0].toISOString();
      params.endDate = activeFilters.value.dateRange[1].toISOString();
    }
    if (activeFilters.value.knowledgeKeyword) params.knowledgeKeyword = activeFilters.value.knowledgeKeyword;

    const result = await chatApi.getConversations(params as Parameters<typeof chatApi.getConversations>[0]);
    conversations.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function handleFilterChange(filters: typeof activeFilters.value) {
  activeFilters.value = filters;
  page.value = 1;
  loadHistory();
}

function openConversation(id: string) {
  chatStore.setActiveConversation(id);
  router.push('/app/chat');
}

function deleteConversation(id: string) {
  Modal.confirm({
    title: '确认删除',
    content: '删除后无法恢复，确认删除此对话？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await chatApi.deleteConversation(id);
      message.success('删除成功');
      loadHistory();
    },
  });
}

onMounted(async () => {
  await subjectsApi.getMySubjects().then((list) => subjectStore.setSubjects(list)).catch(() => {});
  loadHistory();
});
</script>

<style scoped lang="less">
.page-container {
  padding: 24px 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
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

.history-content {
  background: #fff;
  border-radius: @radius-lg;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
  overflow: hidden;
}

.history-summary {
  padding: 14px 20px;
  font-size: 13px;
  color: @color-text-muted;
  border-bottom: 1px solid @color-border-light;
}

.history-empty {
  padding: 60px 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
}

.history-pagination {
  padding: 20px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid @color-border-light;
}
</style>
