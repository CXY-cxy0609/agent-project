<template>
  <div class="chat-page">
    <!-- Left: Conversation List -->
    <conversation-sidebar
      :conversations="conversationItems"
      :active-conversation-id="chatStore.activeConversationId"
      :selected-subject-id="selectedSubjectId"
      :subject-options="subjectOptions"
      @new-chat="startNewChat"
      @select-conversation="handleConvSelect"
      @subject-change="handleSubjectChange"
    />

    <!-- Center: Chat Area -->
    <div class="chat-main">
      <!-- No subject warning -->
      <div v-if="!selectedSubjectId" class="no-subject-tip">
        <a-result
          status="info"
          title="请先选择学科"
          sub-title="在左侧选择一个学科后，即可开始对话。如果还没有学科，请前往学科管理添加。"
        >
          <template #extra>
            <a-button type="primary" @click="$router.push('/app/subjects')">
              前往学科管理
            </a-button>
          </template>
        </a-result>
      </div>

      <!-- Welcome state (no active conversation) -->
      <chat-welcome
        v-else-if="!chatStore.activeConversationId"
        @send-prompt="sendQuickPrompt"
      />

      <!-- Chat Messages -->
      <template v-else>
        <chat-header
          :title="activeConversation?.title"
          v-model:selected-model="selectedModel"
          :model-options="modelOptions"
          @delete="deleteConversation"
        />

        <!-- Video progress bar -->
        <video-progress-bar v-if="videoProgress" :progress="videoProgress" />

        <!-- Messages (Ant Design X) -->
        <div ref="messagesContainer" class="messages-container">
          <x-bubble-list :items="bubbleItems" class="bubble-list" />
        </div>

        <!-- ThoughtChain (collapsible) -->
        <div v-if="lastThoughtChain.length" class="thought-chain-wrap">
          <a-collapse ghost>
            <a-collapse-panel key="thought" header="推理过程">
              <x-thought-chain :items="lastThoughtChain" />
            </a-collapse-panel>
          </a-collapse>
        </div>
      </template>

      <!-- Sender -->
      <message-sender
        v-if="selectedSubjectId"
        v-model="inputValue"
        v-model:generate-video="generateVideo"
        :attachments="attachments"
        :is-streaming="chatStore.isStreaming"
        @send="handleSend"
        @cancel="handleCancel"
        @file-upload="handleFileUpload"
        @remove-attachment="removeAttachment"
      />
    </div>

    <!-- Right: Learning Sidebar (collapsible) -->
    <learning-panel
      v-model:collapsed="rightPanelCollapsed"
      :active-subject="activeSubject"
      :weak-points="mockWeakPoints"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { BubbleList as XBubbleList, ThoughtChain as XThoughtChain } from 'ant-design-x-vue';
import { useChatStore } from '@/stores/chat';
import { useSubjectStore } from '@/stores/subject';
import { chatApi } from '@/api/chat';
import { subjectsApi } from '@/api/subjects';
import ConversationSidebar from '@/components/chat/ConversationSidebar.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';
import ChatWelcome from '@/components/chat/ChatWelcome.vue';
import VideoProgressBar from '@/components/chat/VideoProgressBar.vue';
import LearningPanel from '@/components/chat/LearningPanel.vue';
import MessageSender from '@/components/chat/MessageSender.vue';
import type { Conversation, Message } from '@tutor/shared';

const chatStore = useChatStore();
const subjectStore = useSubjectStore();

const selectedSubjectId = ref<number | null>(subjectStore.activeSubjectId);
const selectedModel = ref('claude-3-5-sonnet');
const inputValue = ref('');
const generateVideo = ref(false);
const attachments = ref<Array<{ uid: string; name: string; url: string; type: string }>>([]);
const messagesContainer = ref<HTMLElement | null>(null);
const rightPanelCollapsed = ref(false);
const videoProgress = ref<{ percent: number; status: string; description: string } | null>(null);

const modelOptions = [
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'DeepSeek V3', value: 'deepseek-v3' },
];

const mockWeakPoints = [
  { text: '极限与连续', color: 'error' },
  { text: '微分方程', color: 'warning' },
  { text: '向量代数', color: 'warning' },
];

const subjectOptions = computed(() =>
  subjectStore.subjects.map((s) => ({ label: s.name, value: s.id })),
);

const activeSubject = computed(() =>
  subjectStore.subjects.find((s) => s.id === selectedSubjectId.value),
);

const activeConversation = computed<Conversation | undefined>(() =>
  chatStore.conversations.find((c) => c.id === chatStore.activeConversationId),
);

const conversationItems = computed(() =>
  chatStore.conversations.map((c) => ({
    key: c.id,
    label: c.title || '新对话',
    description: c.subjectName,
    timestamp: new Date(c.updatedAt).getTime(),
  })),
);

const bubbleItems = computed(() =>
  chatStore.messages.map((m: Message) => ({
    key: m.id,
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    loading: m.status === 'streaming' && !m.content,
    typing: m.status === 'streaming' && !!m.content,
    avatar:
      m.role === 'assistant'
        ? { icon: '研', style: { background: 'var(--color-primary)' } }
        : undefined,
  })),
);

const lastThoughtChain = computed(() => {
  const last = chatStore.messages.findLast(
    (m) => m.role === 'assistant' && m.metadata?.thoughtChain,
  );
  return last?.metadata?.thoughtChain ?? [];
});

async function loadSubjects() {
  try {
    const subjects = await subjectsApi.getMySubjects();
    subjectStore.setSubjects(subjects);
  } catch {}
}

async function loadConversations() {
  if (!selectedSubjectId.value) return;
  try {
    const result = await chatApi.getConversations({ subjectId: selectedSubjectId.value });
    chatStore.setConversations(result.list);
  } catch {}
}

async function handleConvSelect(key: string) {
  chatStore.setActiveConversation(key);
  try {
    const msgs = await chatApi.getMessages(key);
    chatStore.setMessages(msgs);
    scrollToBottom();
  } catch {}
}

async function startNewChat() {
  chatStore.setActiveConversation(null);
  chatStore.setMessages([]);
  inputValue.value = '';
  attachments.value = [];
  videoProgress.value = null;
}

function handleSubjectChange(id: number) {
  selectedSubjectId.value = id;
  subjectStore.setActiveSubject(id);
  chatStore.setActiveConversation(null);
  chatStore.setMessages([]);
  loadConversations();
}

function sendQuickPrompt(prompt: string) {
  inputValue.value = prompt;
  handleSend(prompt);
}

let cancelStream: (() => void) | null = null;

async function handleSend(text: string) {
  if (!text.trim() || !selectedSubjectId.value || chatStore.isStreaming) return;

  inputValue.value = '';
  const userMsg: Message = {
    id: Date.now().toString(),
    conversationId: chatStore.activeConversationId ?? '',
    role: 'user',
    content: text,
    status: 'done',
    createdAt: new Date().toISOString(),
    attachments: [],
  };
  chatStore.appendMessage(userMsg);

  const assistantMsg: Message = {
    id: (Date.now() + 1).toString(),
    conversationId: chatStore.activeConversationId ?? '',
    role: 'assistant',
    content: '',
    status: 'streaming',
    createdAt: new Date().toISOString(),
  };
  chatStore.appendMessage(assistantMsg);
  chatStore.setStreaming(true);
  scrollToBottom();

  let accumulated = '';

  cancelStream = chatApi.sendMessage(
    {
      conversationId: chatStore.activeConversationId ?? undefined,
      subjectId: selectedSubjectId.value!,
      content: text,
      model: selectedModel.value,
      generateVideo: generateVideo.value,
    },
    (chunk) => {
      accumulated += chunk;
      chatStore.updateLastAssistantMessage(accumulated, false);
      scrollToBottom();
    },
    (conv) => {
      chatStore.updateLastAssistantMessage(accumulated, true);
      chatStore.setStreaming(false);
      if (conv.id && !chatStore.activeConversationId) {
        chatStore.setActiveConversation(conv.id);
        chatStore.addConversation(conv);
      }
    },
    (_err) => {
      chatStore.updateLastAssistantMessage(accumulated || '发生错误，请重试', true);
      chatStore.setStreaming(false);
    },
  );
}

function handleCancel() {
  if (cancelStream) {
    cancelStream();
    cancelStream = null;
  }
  chatStore.setStreaming(false);
}

async function deleteConversation() {
  Modal.confirm({
    title: '确认删除',
    content: '删除后无法恢复，确认删除此对话？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      if (!chatStore.activeConversationId) return;
      await chatApi.deleteConversation(chatStore.activeConversationId);
      chatStore.setConversations(
        chatStore.conversations.filter((c) => c.id !== chatStore.activeConversationId),
      );
      chatStore.setActiveConversation(null);
      message.success('删除成功');
    },
  });
}

function handleFileUpload(file: File) {
  attachments.value.push({
    uid: Date.now().toString(),
    name: file.name,
    url: URL.createObjectURL(file),
    type: file.type.startsWith('image/') ? 'image' : 'file',
  });
}

function removeAttachment(uid: string) {
  attachments.value = attachments.value.filter((a) => a.uid !== uid);
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

watch(() => chatStore.messages, scrollToBottom, { deep: true });

onMounted(async () => {
  await loadSubjects();
  await loadConversations();
});
</script>

<style scoped lang="less">
.chat-page {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: @color-bg;
  position: relative;
}

.no-subject-tip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.bubble-list {
  max-width: 800px;
  margin: 0 auto;
}

.thought-chain-wrap {
  flex-shrink: 0;
  padding: 0 20px;
  border-top: 1px solid @color-border;
  background: #fff;
}
</style>
