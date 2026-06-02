<template>
  <section class="video-card" aria-label="生成的视频">
    <video
      class="video-player"
      :src="videoUrl"
      controls
      preload="metadata"
      playsinline
    >
      当前浏览器不支持视频播放。
    </video>

    <div class="video-meta">
      <span v-if="videoRunId" class="meta-text">运行ID：{{ videoRunId }}</span>
      <a :href="videoUrl" target="_blank" rel="noopener noreferrer">新窗口打开</a>
      <a
        v-if="artifactBundleUrl"
        :href="artifactBundleUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        运行归档
      </a>
      <a
        v-if="artifactManifestUrl"
        :href="artifactManifestUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        运行清单
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  videoUrl: string;
  videoRunId?: string;
  artifactBundleUrl?: string;
  artifactManifestUrl?: string;
}>();
</script>

<style scoped lang="less">
.video-card {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.video-player {
  display: block;
  width: 100%;
  max-height: 420px;
  border-radius: 10px;
  background: #0f172a;
}

.video-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.62);
}

.meta-text {
  word-break: break-all;
}
</style>
