<template>
  <div class="chat-welcome-wrap">
    <x-welcome
      variant="borderless"
      :icon="welcomeIcon"
      title="你好，我是研智 AI"
      description="我可以帮你讲解知识点、解析题目，并根据你的学习记录提供个性化建议。"
      class="chat-welcome"
    >
      <template #extra>
        <div class="welcome-prompts">
          <div
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="prompt-chip"
            @click="$emit('send-prompt', prompt)"
          >
            {{ prompt }}
          </div>
        </div>
      </template>
    </x-welcome>
  </div>
</template>

<script setup lang="ts">
import { h, type VNode } from 'vue';
import { Welcome as XWelcome } from 'ant-design-x-vue';

defineEmits<{
  'send-prompt': [prompt: string];
}>();

const quickPrompts = [
  '帮我讲解泰勒公式',
  '如何理解马克思主义哲学的基本原理？',
  '英语长难句如何快速分析？',
  '帮我制定一个月的高数复习计划',
];

const welcomeIcon: VNode = h(
  'div',
  {
    style: {
      width: '56px',
      height: '56px',
      background: 'linear-gradient(135deg, #1a3a6e, #2a5298)',
      borderRadius: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Noto Serif SC', 'Songti SC', Georgia, serif",
      fontSize: '26px',
      fontWeight: '700',
      color: '#fff',
      flexShrink: '0',
      boxShadow: '0 4px 16px rgba(26, 58, 110, 0.3)',
    },
  },
  '研',
);
</script>

<style scoped lang="less">
.chat-welcome-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: radial-gradient(ellipse at 60% 40%, rgba(42, 82, 152, 0.05) 0%, transparent 70%),
              radial-gradient(ellipse at 30% 70%, rgba(212, 160, 23, 0.04) 0%, transparent 60%);
}

.chat-welcome {
  max-width: 600px;
  width: 100%;

  :deep(.ant-welcome-title) {
    font-family: @font-serif;
    font-size: 22px;
    font-weight: 600;
    color: @color-text-primary;
  }

  :deep(.ant-welcome-description) {
    font-size: 14px;
    color: @color-text-secondary;
    line-height: 1.7;
  }
}

.welcome-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 20px;
}

.prompt-chip {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid @color-border;
  border-radius: 100px;
  font-size: 13px;
  color: @color-text-secondary;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: @shadow-sm;
  white-space: nowrap;
}

.prompt-chip:hover {
  border-color: @color-primary;
  color: @color-primary;
  background: rgba(26, 58, 110, 0.04);
  box-shadow: 0 2px 8px rgba(26, 58, 110, 0.12);
  transform: translateY(-1px);
}
</style>
