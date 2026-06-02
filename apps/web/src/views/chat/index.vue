<template>
  <div class="chat-page">
    <!-- Left: Conversation List -->
    <conversation-sidebar
      :conversations="conversationItems"
      :active-conversation-id="chatStore.activeConversationId"
      @new-chat="startNewChat"
      @select-conversation="handleConvSelect"
    />

    <!-- Center: Chat Area -->
    <div class="chat-main">
      <!-- Welcome state (no active conversation) -->
      <chat-welcome
        v-if="!chatStore.activeConversationId && chatStore.messages.length === 0"
        @send-prompt="sendQuickPrompt"
      />

      <!-- Chat Messages -->
      <template v-else-if="chatStore.activeConversationId || chatStore.messages.length > 0">
        <chat-header
          :title="activeConversation?.title"
          @delete="deleteConversation"
        />

        <!-- Video progress bar -->
        <video-progress-bar v-if="videoProgress" :progress="videoProgress" />

        <!-- Messages (Ant Design X) -->
        <div ref="messagesContainer" class="messages-container">
          <div class="bubble-list">
            <div
              v-for="item in bubbleItems"
              :key="item.key"
              class="bubble-row"
              :class="item.role"
            >
              <div class="bubble" :class="{ user: item.role === 'user', assistant: item.role === 'assistant' }">
                <assistant-message-content
                  v-if="item.role === 'assistant'"
                  :content="item.content || (item.loading ? '思考中...' : '')"
                  :show-copy="!item.loading"
                  :video-url="item.videoUrl"
                  :video-run-id="item.videoRunId"
                  :artifact-bundle-url="item.artifactBundleUrl"
                  :artifact-manifest-url="item.artifactManifestUrl"
                />
                <div v-if="item.role !== 'assistant' && item.content" class="plain-text">
                  {{ item.content }}
                </div>
                <message-attachments
                  v-if="item.role !== 'assistant'"
                  :attachments="item.attachments"
                />
              </div>
            </div>
          </div>
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
import { ThoughtChain as XThoughtChain } from 'ant-design-x-vue';
import { useChatStore } from '@/stores/chat';
import { useSubjectStore } from '@/stores/subject';
import { useAuthStore } from '@/stores/auth';
import { chatApi, type StreamAssistantMeta } from '@/api/chat';
import { subjectsApi } from '@/api/subjects';
import ConversationSidebar from '@/components/chat/ConversationSidebar.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';
import ChatWelcome from '@/components/chat/ChatWelcome.vue';
import VideoProgressBar from '@/components/chat/VideoProgressBar.vue';
import LearningPanel from '@/components/chat/LearningPanel.vue';
import MessageSender from '@/components/chat/MessageSender.vue';
import MessageAttachments from '@/components/chat/MessageAttachments.vue';
import AssistantMessageContent from '@/components/chat/AssistantMessageContent.vue';
import type { Conversation, Message, MessageAttachment } from '@tutor/shared';
import { normalizeAssistantStreamContent } from '@/utils/chat-stream';

const chatStore = useChatStore();
const subjectStore = useSubjectStore();
const authStore = useAuthStore();

const inputValue = ref('');
const generateVideo = ref(false);
type LocalAttachment = { uid: string; name: string; url: string; type: string; rawFile: File };
const attachments = ref<LocalAttachment[]>([]);
const maxImageAttachments = 9;
const messagesContainer = ref<HTMLElement | null>(null);
const rightPanelCollapsed = ref(false);
const videoProgress = ref<{ percent: number; status: string; description: string } | null>(null);
let attachmentUidSeed = 0;

const mockWeakPoints = [
  { text: '极限与连续', color: 'error' },
  { text: '微分方程', color: 'warning' },
  { text: '向量代数', color: 'warning' },
];

const activeSubject = computed(() =>
  subjectStore.subjects.find((s) => s.id === activeConversation.value?.subjectId) ??
  subjectStore.subjects[0],
);

const activeConversation = computed<Conversation | undefined>(() =>
  chatStore.conversations.find((c) => c.id === chatStore.activeConversationId),
);

const conversationItems = computed(() =>
  chatStore.conversations.map((c) => ({
    key: c.id,
    label: c.title || '新对话',
    description: c.subjectName || subjectStore.subjects.find((subject) => subject.id === c.subjectId)?.name,
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
    attachments: m.attachments ?? [],
    videoUrl: m.metadata?.videoUrl,
    videoRunId: m.metadata?.videoRunId,
    artifactBundleUrl: m.metadata?.artifactBundleUrl,
    artifactManifestUrl: m.metadata?.artifactManifestUrl,
  })),
);

type ThoughtChainStatus = 'pending' | 'error' | 'success';

function mapThoughtStatus(status: 'pending' | 'running' | 'done' | 'error'): ThoughtChainStatus {
  switch (status) {
    case 'done':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'pending';
  }
}

const lastThoughtChain = computed(() => {
  let last: Message | undefined;
  for (let i = chatStore.messages.length - 1; i >= 0; i--) {
    const candidate = chatStore.messages[i];
    if (candidate?.role === 'assistant' && candidate.metadata?.thoughtChain) {
      last = candidate;
      break;
    }
  }
  return (last?.metadata?.thoughtChain ?? []).map((step) => ({
    title: step.title,
    description: step.content,
    status: mapThoughtStatus(step.status),
  }));
});

async function loadSubjects() {
  try {
    const subjects = await subjectsApi.getMySubjects();
    subjectStore.setSubjects(subjects);
  } catch {}
}

async function loadConversations() {
  try {
    const result = await chatApi.getConversations();
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
  generateVideo.value = false;
  clearAttachments();
  videoProgress.value = null;
}

function sendQuickPrompt(prompt: string) {
  inputValue.value = prompt;
  handleSend(prompt);
}

let cancelStream: (() => void) | null = null;

async function handleSend(text: string) {
  const pendingAttachments = [...attachments.value];
  if ((!text.trim() && pendingAttachments.length === 0) || chatStore.isStreaming) return;

  const shouldGenerateVideo = generateVideo.value;
  let messageAttachments: MessageAttachment[] = [];
  try {
    messageAttachments = await uploadMessageAttachments(pendingAttachments);
  } catch {
    message.error('附件上传失败，请稍后重试');
    return;
  }
  const streamImages = messageAttachments
    .filter((item) => item.type === 'image')
    .slice(0, maxImageAttachments)
    .map((item) => ({
      url: item.url,
      mediaType: item.mimeType,
    }));
  const streamContent = text.trim() || (streamImages.length > 0 ? '请分析这些图片。' : '我发送了附件，请查看。');
  const titleSource = text.trim() || pendingAttachments[0]?.name || '新对话';

  const existingConversationId = chatStore.activeConversationId;
  let conversationId = existingConversationId ?? '';
  const inferredSubjectId =
    activeConversation.value?.subjectId ?? subjectStore.activeSubjectId ?? subjectStore.subjects[0]?.id ?? 0;
  if (!existingConversationId) {
    try {
      const createdConversation = await chatApi.createConversation({
        title: titleSource.slice(0, 24) || '新对话',
        subjectId: inferredSubjectId || undefined,
        userId: authStore.user?.id ?? 'anonymous',
      });
      conversationId = createdConversation.id;
      chatStore.addConversation(createdConversation);
      chatStore.setActiveConversation(createdConversation.id);
      if (createdConversation.subjectId) {
        subjectStore.setActiveSubject(createdConversation.subjectId);
      }
    } catch {
      // 创建会话失败时降级为流式后端建会话，避免阻塞用户问答。
      conversationId = '';
    }
  }

  inputValue.value = '';
  generateVideo.value = false;
  clearAttachments();
  const userMsg: Message = {
    id: Date.now().toString(),
    conversationId,
    role: 'user',
    content: text,
    status: 'done',
    createdAt: new Date().toISOString(),
    attachments: messageAttachments,
  };
  chatStore.appendMessage(userMsg);

  const assistantMsg: Message = {
    id: (Date.now() + 1).toString(),
    conversationId,
    role: 'assistant',
    content: '',
    status: 'streaming',
    createdAt: new Date().toISOString(),
  };
  chatStore.appendMessage(assistantMsg);
  chatStore.setStreaming(true);
  scrollToBottom();

  let accumulatedRaw = '';

  cancelStream = chatApi.sendMessage(
    {
      conversationId: conversationId || undefined,
      subjectId: inferredSubjectId || undefined,
      content: streamContent,
      generateVideo: shouldGenerateVideo,
      userId: authStore.user?.id ?? 'anonymous',
      images: streamImages,
      availableSubjects: subjectStore.subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        code: subject.code,
      })),
    },
    (chunk) => {
      accumulatedRaw += chunk;
      chatStore.updateLastAssistantMessage(normalizeAssistantStreamContent(accumulatedRaw), false);
      scrollToBottom();
    },
    (conv, meta: StreamAssistantMeta) => {
      const normalizedAssistant = normalizeAssistantStreamContent(accumulatedRaw);
      chatStore.updateLastAssistantMessage(normalizedAssistant, true);
      if (meta.videoUrl || meta.videoRunId || meta.artifactBundleUrl || meta.artifactManifestUrl) {
        chatStore.updateLastAssistantMetadata({
          videoUrl: meta.videoUrl,
          videoRunId: meta.videoRunId,
          artifactBundleUrl: meta.artifactBundleUrl,
          artifactManifestUrl: meta.artifactManifestUrl,
        });
      }
      chatStore.setStreaming(false);
      const finalConversationId = conv.id || conversationId;
      if (finalConversationId) {
        const finalSubjectId = conv.subjectId || inferredSubjectId || 0;
        const existing = chatStore.conversations.find((item) => item.id === finalConversationId);
        const mergedConversation: Conversation = {
          ...conv,
          id: finalConversationId,
          subjectId: finalSubjectId,
          subjectName:
            conv.subjectName ??
            (finalSubjectId ? `学科 ${finalSubjectId}` : '未分配学科'),
        };
        if (!existing) {
          chatStore.addConversation(mergedConversation);
        } else {
          chatStore.setConversations(
            chatStore.conversations.map((item) => (
              item.id === finalConversationId ? { ...item, ...mergedConversation } : item
            )),
          );
        }
        if (finalSubjectId) {
          subjectStore.setActiveSubject(finalSubjectId);
        }
        if (!chatStore.activeConversationId || chatStore.activeConversationId === conversationId) {
          chatStore.setActiveConversation(finalConversationId);
        }
        chatApi.appendMessage(finalConversationId, {
          id: userMsg.id,
          role: 'user',
          content: text,
          status: 'done',
          attachments: messageAttachments,
        }).catch(() => {});
        chatApi.appendMessage(finalConversationId, {
          id: assistantMsg.id,
          role: 'assistant',
          content: normalizedAssistant,
          status: 'done',
          metadata: {
            videoUrl: meta.videoUrl,
            videoRunId: meta.videoRunId,
            artifactBundleUrl: meta.artifactBundleUrl,
            artifactManifestUrl: meta.artifactManifestUrl,
          },
        }).catch(() => {});
      }
    },
    (_err) => {
      const normalizedAssistant = normalizeAssistantStreamContent(accumulatedRaw);
      chatStore.updateLastAssistantMessage(normalizedAssistant || '发生错误，请重试', true);
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
  if (!file.type.startsWith('image/')) {
    message.warning('当前对话页暂只支持上传图片');
    return;
  }
  if (attachments.value.length >= maxImageAttachments) {
    message.warning(`最多支持上传 ${maxImageAttachments} 张图片`);
    return;
  }
  attachments.value.push({
    uid: `attachment-${Date.now()}-${attachmentUidSeed++}`,
    name: file.name || `pasted-${attachmentUidSeed}`,
    url: URL.createObjectURL(file),
    type: file.type.startsWith('image/') ? 'image' : 'file',
    rawFile: file,
  });
}

async function uploadMessageAttachments(items: LocalAttachment[]): Promise<MessageAttachment[]> {
  if (!items.length) return [];
  return Promise.all(items.map((item) => chatApi.uploadAttachment(item.rawFile)));
}

function removeAttachment(uid: string) {
  const target = attachments.value.find((a) => a.uid === uid);
  if (target) {
    URL.revokeObjectURL(target.url);
  }
  attachments.value = attachments.value.filter((a) => a.uid !== uid);
}

function clearAttachments() {
  attachments.value.forEach((item) => URL.revokeObjectURL(item.url));
  attachments.value = [];
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

<style lang="less" src="@/assets/styles/chat-page.less"></style>
