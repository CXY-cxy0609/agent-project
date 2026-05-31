<template>
  <div class="markdown-wrap">
    <div class="markdown-body" v-html="renderedHtml"></div>
    <button
      v-if="showCopy"
      type="button"
      class="copy-btn"
      :class="{ copied }"
      :title="copied ? '已复制' : '复制内容'"
      :aria-label="copied ? '已复制' : '复制内容'"
      @click="handleCopy"
    >
      <check-outlined v-if="copied" />
      <copy-outlined v-else />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { renderMarkdown } from '@/utils/markdown';
import { message } from 'ant-design-vue';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons-vue';

const props = defineProps<{
  content: string;
  showCopy?: boolean;
}>();

const renderedHtml = computed(() => renderMarkdown(props.content));
const copied = ref(false);
let copyTimer: number | null = null;

async function handleCopy() {
  if (!props.content?.trim()) return;
  try {
    await navigator.clipboard.writeText(props.content);
    copied.value = true;
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      copied.value = false;
      copyTimer = null;
    }, 1600);
  } catch {
    message.error('复制失败，请手动复制');
  }
}
</script>

<style scoped lang="less">
.markdown-wrap {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.copy-btn {
  align-self: flex-end;
  margin-top: 6px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgba(255, 255, 255, 0.96);
  color: rgba(15, 23, 42, 0.62);
  border-radius: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 15px;
  cursor: pointer;
  opacity: 0;
  transform: translateY(3px);
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.copy-btn:hover {
  color: rgba(15, 23, 42, 0.9);
  border-color: rgba(15, 23, 42, 0.24);
}

.copy-btn.copied {
  color: #1677ff;
  border-color: rgba(22, 119, 255, 0.35);
}

.markdown-wrap:hover .copy-btn,
.copy-btn.copied {
  opacity: 1;
  transform: translateY(0);
}

.markdown-body {
  line-height: 1.7;
  word-break: break-word;
  white-space: normal;

  :deep(p) {
    margin: 0 0 8px;
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }

  :deep(pre) {
    margin: 8px 0;
    padding: 10px;
    border-radius: 8px;
    overflow-x: auto;
    background: rgba(15, 23, 42, 0.92);
    color: #e2e8f0;
  }

  :deep(code) {
    font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 12px;
  }

  :deep(:not(pre) > code) {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(100, 116, 139, 0.14);
  }

  :deep(ul),
  :deep(ol) {
    margin: 6px 0 8px 20px;
    padding: 0;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(blockquote) {
    margin: 8px 0;
    padding-left: 12px;
    color: rgba(15, 23, 42, 0.75);
    border-left: 3px solid rgba(15, 23, 42, 0.2);
  }

  :deep(table) {
    width: 100%;
    margin: 10px 0;
    border-collapse: collapse;
  }

  :deep(.katex-display) {
    margin: 10px 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  :deep(th),
  :deep(td) {
    padding: 6px 8px;
    border: 1px solid rgba(15, 23, 42, 0.15);
    text-align: left;
  }
}
</style>
