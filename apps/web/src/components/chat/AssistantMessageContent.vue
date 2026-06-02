<template>
  <div class="assistant-content">
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
import MarkdownMessage from './MarkdownMessage.vue';
import VideoMessageCard from './VideoMessageCard.vue';

defineProps<{
  content: string;
  showCopy?: boolean;
  videoUrl?: string;
  videoRunId?: string;
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
}>();
</script>

<style scoped lang="less">
.assistant-content {
  width: 100%;
}

.video-run-meta {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.62);
}
</style>
