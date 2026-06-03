<template>
  <div class="assistant-content">
    <a-collapse
      v-if="reasoningItems.length"
      class="deep-thinking"
      ghost
    >
      <a-collapse-panel key="thinking">
        <template #header>
          <span class="deep-thinking-title">深度思考</span>
        </template>
        <div class="reasoning-lines">
          <div
            v-for="item in reasoningItems"
            :key="item.key"
            class="reasoning-line"
          >
            {{ item.content }}
          </div>
        </div>
      </a-collapse-panel>
    </a-collapse>
    <markdown-message
      :content="content"
      :show-copy="showCopy"
    />
    <video-message-card
      v-if="videoUrl"
      :video-url="videoUrl"
      :video-run-id="videoRunId"
      :artifact-bundle-url="artifactBundleUrl"
      :artifact-manifest-url="artifactManifestUrl"
    />
    <div v-else-if="videoRunId" class="video-run-meta">
      运行ID：{{ videoRunId }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownMessage from './MarkdownMessage.vue';
import VideoMessageCard from './VideoMessageCard.vue';

const props = defineProps<{
  content: string;
  showCopy?: boolean;
  videoUrl?: string;
  videoRunId?: string;
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
  reasoning?: string;
  semanticSummary?: string;
}>();

const reasoningItems = computed(() => {
  const items: Array<{ key: string; content: string }> = [];
  const reasoning = props.reasoning?.trim();
  const semanticSummary = props.semanticSummary?.trim();

  if (reasoning) items.push({ key: 'reasoning', content: reasoning });
  if (semanticSummary) items.push({ key: 'semanticSummary', content: semanticSummary });

  return items;
});
</script>

<style scoped lang="less">
.assistant-content {
  width: 100%;
}

.deep-thinking {
  margin-bottom: 8px;
  background: transparent;

  :deep(.ant-collapse-item) {
    border: 0;
  }

  :deep(.ant-collapse-header) {
    width: fit-content;
    align-items: center;
    padding: 0 2px 2px 0 !important;
    border-radius: 6px;
    color: rgba(15, 23, 42, 0.42);
    font-size: 13px;
    line-height: 20px;
    transition: color 0.18s ease;
  }

  :deep(.ant-collapse-header:hover) {
    color: rgba(15, 23, 42, 0.62);
  }

  :deep(.ant-collapse-expand-icon) {
    height: 20px;
    margin-inline-end: 4px;
    color: currentcolor;
  }

  :deep(.ant-collapse-arrow) {
    font-size: 11px;
  }

  :deep(.ant-collapse-content) {
    border: 0;
    background: transparent;
  }

  :deep(.ant-collapse-content-box) {
    margin-left: 6px;
    padding: 4px 0 8px 18px !important;
    border-left: 1px solid rgba(15, 23, 42, 0.08);
  }

}

.deep-thinking-title {
  font-weight: 400;
}

.reasoning-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reasoning-line {
  color: rgba(15, 23, 42, 0.52);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.video-run-meta {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.62);
}
</style>
