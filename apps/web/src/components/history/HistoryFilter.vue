<template>
  <div class="filter-card">
    <a-row :gutter="[16, 12]" align="middle">
      <a-col :span="7">
        <a-input
          v-model:value="localFilters.title"
          placeholder="搜索对话标题"
          allow-clear
          :prefix="h(SearchOutlined)"
          @change="emitChange"
        />
      </a-col>
      <a-col :span="5">
        <a-select
          v-model:value="localFilters.subjectId"
          placeholder="按学科筛选"
          allow-clear
          style="width: 100%"
          :options="subjectOptions"
          @change="emitChange"
        />
      </a-col>
      <a-col :span="7">
        <a-range-picker
          v-model:value="localFilters.dateRange"
          :placeholder="['开始日期', '结束日期']"
          style="width: 100%"
          @change="emitChange"
        />
      </a-col>
      <a-col :span="5">
        <a-input
          v-model:value="localFilters.knowledgeKeyword"
          placeholder="知识点语义搜索"
          allow-clear
          :prefix="h(BulbOutlined)"
          @change="emitChange"
        >
          <template #suffix>
            <a-tooltip title="通过向量化语义搜索知识点">
              <QuestionCircleOutlined style="color: var(--color-text-muted)" />
            </a-tooltip>
          </template>
        </a-input>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { reactive, h } from 'vue';
import { SearchOutlined, BulbOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue';
import type { Dayjs } from 'dayjs';

interface SubjectOption {
  label: string;
  value: string;
}

interface Filters {
  title: string;
  subjectId: string | undefined;
  dateRange: [Dayjs, Dayjs] | null;
  knowledgeKeyword: string;
}

defineProps<{
  subjectOptions: SubjectOption[];
}>();

const emit = defineEmits<{
  change: [filters: Filters];
}>();

const localFilters = reactive<Filters>({
  title: '',
  subjectId: undefined,
  dateRange: null,
  knowledgeKeyword: '',
});

function emitChange() {
  emit('change', { ...localFilters });
}
</script>

<style scoped lang="less">
.filter-card {
  background: #fff;
  border-radius: @radius-lg;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid @color-border;
  box-shadow: @shadow-sm;
}
</style>
