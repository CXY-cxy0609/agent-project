<template>
  <a-table :columns="columns" :data-source="items" :loading="loading" row-key="id" :pagination="false">
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'title'">
        <div class="assessment-title">{{ record.title || '专项训练' }}</div>
      </template>

      <template v-else-if="column.key === 'knowledgePoints'">
        <a-space v-if="record.knowledgePoints?.length" :size="4" wrap>
          <a-tag v-for="point in visibleKnowledgePoints(record)" :key="point.knowledgeKey || point.label">
            {{ point.label || point.knowledgeKey }}
          </a-tag>
        </a-space>
        <span v-else class="muted">-</span>
      </template>

      <template v-else-if="column.key === 'status'">
        <a-tag :color="statusColor(record.status)">
          <span v-if="record.status === 'generating'" class="generating-dot" />
          {{ record.statusLabel || statusLabel(record.status) }}
        </a-tag>
      </template>

      <template v-else-if="column.key === 'progress'">
        <span v-if="record.status === 'generating'">
          生成中 · {{ record.generatedCount ?? 0 }}/{{ record.questionCount ?? '-' }}
        </span>
        <span v-else>{{ record.answeredCount ?? 0 }}/{{ record.questionCount ?? 0 }} 已答</span>
      </template>

      <template v-else-if="column.key === 'score'">
        <span v-if="record.status === 'graded'">{{ record.totalScore ?? 0 }}/{{ record.maxScore ?? '-' }}</span>
        <span v-else class="muted">未批改</span>
      </template>

      <template v-else-if="column.key === 'actions'">
        <a-space>
          <a-button
            v-if="canRegenerate(record)"
            size="small"
            type="primary"
            @click="$emit('regenerate', record.id)"
          >
            重新生成
          </a-button>
          <a-button
            size="small"
            type="primary"
            :disabled="!canTake(record)"
            @click="$emit('take', record.id)"
          >
            做题
          </a-button>
          <a-button
            size="small"
            :disabled="record.status !== 'submitted' || Boolean(props.gradingId && props.gradingId !== record.id)"
            :loading="props.gradingId === record.id"
            @click="$emit('grade', record.id)"
          >
            批改
          </a-button>
          <a-button
            size="small"
            :disabled="record.status !== 'graded'"
            @click="$emit('result', record.id)"
          >
            查看批改
          </a-button>
        </a-space>
      </template>
    </template>
  </a-table>
</template>

<script setup lang="ts">
import type { Assessment } from '@tutor/shared';

const props = defineProps<{
  items: Assessment[];
  loading: boolean;
  gradingId?: string;
}>();

defineEmits<{
  take: [id: string];
  grade: [id: string];
  result: [id: string];
  regenerate: [id: string];
}>();

const columns = [
  { title: '测试', key: 'title', width: 220 },
  { title: '知识点', key: 'knowledgePoints', width: 320 },
  { title: '状态', key: 'status', width: 120 },
  { title: '进度', key: 'progress', width: 140 },
  { title: '得分', key: 'score', width: 120 },
  { title: '时间', dataIndex: 'displayTime', key: 'displayTime', width: 140 },
  { title: '操作', key: 'actions', width: 260 },
];

function canTake(record: Assessment) {
  return record.status === 'answering' || record.status === 'draft';
}

function canRegenerate(record: Assessment) {
  return record.status === 'failed';
}

function statusLabel(status: string) {
  return {
    generating: '生成中',
    answering: '待作答',
    draft: '待作答',
    submitted: '待批改',
    graded: '已批改',
    failed: '生成失败',
  }[status] ?? status;
}

function visibleKnowledgePoints(record: Assessment) {
  return (record.knowledgePoints ?? []).slice(0, 2);
}

function statusColor(status: string) {
  return {
    generating: 'processing',
    answering: 'blue',
    draft: 'blue',
    submitted: 'orange',
    graded: 'green',
    failed: 'red',
  }[status] ?? 'default';
}
</script>

<style scoped lang="less">
.assessment-title {
  font-weight: 600;
  color: @color-text-primary;
  white-space: nowrap;
}

.assessment-meta,
.muted {
  color: @color-text-muted;
  font-size: 12px;
}

.generating-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
</style>
