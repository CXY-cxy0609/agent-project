<template>
  <a-modal
    :open="open"
    title="搜索并添加学科"
    :footer="null"
    width="560"
    @cancel="$emit('update:open', false)"
  >
    <a-input
      v-model:value="searchKeyword"
      placeholder="输入学科名称、编号或 ID 搜索"
      :prefix="h(SearchOutlined)"
      allow-clear
      style="margin-bottom: 16px"
      @input="onSearchInput"
    />
    <a-spin :spinning="searching">
      <div class="search-results">
        <div
          v-for="s in searchResults"
          :key="s.id"
          class="search-result-item"
        >
          <div class="search-result-info">
            <span class="sr-name">{{ s.name }}</span>
            <a-tag size="small">{{ s.code }}</a-tag>
            <span class="sr-desc">{{ s.description }}</span>
          </div>
          <a-button
            size="small"
            type="primary"
            :loading="addingId === s.id"
            @click="addSubject(s.id)"
          >
            添加
          </a-button>
        </div>
        <a-empty
          v-if="searchResults.length === 0 && !searching && searchKeyword"
          description="未找到匹配学科"
        />
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, h, watch } from 'vue';
import { message } from 'ant-design-vue';
import { SearchOutlined } from '@ant-design/icons-vue';
import { subjectsApi } from '@/api/subjects';
import type { Subject } from '@kaoyan/shared';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  added: [];
}>();

const searchKeyword = ref('');
const searchResults = ref<Subject[]>([]);
const searching = ref(false);
const addingId = ref<string | null>(null);

watch(() => props.open, (val) => {
  if (val) {
    searchKeyword.value = '';
    searchResults.value = [];
  }
});

let searchTimer: ReturnType<typeof setTimeout>;

function onSearchInput() {
  if (!searchKeyword.value.trim()) {
    searchResults.value = [];
    return;
  }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      searchResults.value = await subjectsApi.searchSubjects(searchKeyword.value);
    } finally {
      searching.value = false;
    }
  }, 300);
}

async function addSubject(id: string) {
  addingId.value = id;
  try {
    await subjectsApi.addMySubject(id);
    message.success('添加成功');
    searchResults.value = searchResults.value.filter((s) => s.id !== id);
    emit('added');
  } finally {
    addingId.value = null;
  }
}
</script>

<style scoped lang="less">
.search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 120px;
}

.search-result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid @color-border;
  border-radius: 8px;
  gap: 12px;
}

.search-result-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.sr-name {
  font-size: 14px;
  font-weight: 500;
  color: @color-text-primary;
}

.sr-desc {
  font-size: 12px;
  color: @color-text-muted;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
