<template>
  <div class="video-progress-bar">
    <div class="vp-header">
      <VideoCameraOutlined />
      <span>视频生成中</span>
      <span class="vp-percent">{{ progress.percent }}%</span>
    </div>
    <a-progress
      :percent="progress.percent"
      :status="progressStatus"
      :show-info="false"
      stroke-color="var(--color-accent)"
    />
    <div class="vp-desc">{{ progress.description }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { VideoCameraOutlined } from '@ant-design/icons-vue';

interface VideoProgress {
  percent: number;
  status: string;
  description: string;
}

const props = defineProps<{
  progress: VideoProgress;
}>();

const progressStatus = computed(() => {
  if (props.progress.status === 'error') return 'exception';
  if (props.progress.status === 'done') return 'success';
  return 'active';
});
</script>

<style scoped lang="less">
.video-progress-bar {
  padding: 12px 20px;
  background: rgba(212, 160, 23, 0.06);
  border-bottom: 1px solid rgba(212, 160, 23, 0.2);
  flex-shrink: 0;
}

.vp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: @color-accent-dark;
  margin-bottom: 8px;
  font-weight: 500;
}

.vp-percent {
  margin-left: auto;
  font-weight: 600;
}

.vp-desc {
  font-size: 12px;
  color: @color-text-muted;
  margin-top: 4px;
}
</style>
