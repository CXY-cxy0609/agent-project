import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Conversation, Message } from '@tutor/shared';
import { normalizeMessageOrder } from '@/utils/message-order';

export const useChatStore = defineStore('chat', () => {
  const conversations = ref<Conversation[]>([]);
  const activeConversationId = ref<string | null>(null);
  const messages = ref<Message[]>([]);
  const isStreaming = ref(false);

  function setConversations(list: Conversation[]) {
    conversations.value = list;
  }

  function addConversation(conv: Conversation) {
    conversations.value.unshift(conv);
  }

  function upsertConversation(conv: Conversation) {
    const index = conversations.value.findIndex((item) => item.id === conv.id);
    if (index === -1) {
      conversations.value.unshift(conv);
      return;
    }
    conversations.value[index] = { ...conversations.value[index], ...conv };
  }

  function setActiveConversation(id: string | null) {
    activeConversationId.value = id;
    if (id === null) messages.value = [];
  }

  function setMessages(list: Message[]) {
    messages.value = normalizeMessageOrder(list);
  }

  function appendMessage(msg: Message) {
    messages.value = normalizeMessageOrder([...messages.value, msg]);
  }

  function upsertMessage(msg: Message) {
    const index = messages.value.findIndex((item) => item.id === msg.id);
    if (index === -1) {
      appendMessage(msg);
      return;
    }
    const next = [...messages.value];
    next[index] = { ...next[index], ...msg };
    messages.value = normalizeMessageOrder(next);
  }

  function patchMessage(id: string, patch: Partial<Message>) {
    const index = messages.value.findIndex((item) => item.id === id);
    if (index === -1) return;
    const next = [...messages.value];
    next[index] = { ...next[index], ...patch };
    messages.value = normalizeMessageOrder(next);
  }

  function appendAssistantDelta(id: string, delta: string) {
    const target = messages.value.find((item) => item.id === id);
    if (!target) return;
    target.content += delta;
    target.status = 'streaming';
  }

  function updateLastAssistantMessage(content: string, done = false) {
    let last: Message | undefined;
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i]?.role === 'assistant') {
        last = messages.value[i];
        break;
      }
    }
    if (last) {
      last.content = content;
      last.status = done ? 'done' : 'streaming';
    }
  }

  function updateLastAssistantMetadata(metadata: Message['metadata']) {
    let last: Message | undefined;
    for (let i = messages.value.length - 1; i >= 0; i--) {
      if (messages.value[i]?.role === 'assistant') {
        last = messages.value[i];
        break;
      }
    }
    if (!last) return;
    last.metadata = { ...(last.metadata ?? {}), ...(metadata ?? {}) };
  }

  function setStreaming(val: boolean) {
    isStreaming.value = val;
  }

  return {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    setConversations,
    addConversation,
    upsertConversation,
    setActiveConversation,
    setMessages,
    appendMessage,
    upsertMessage,
    patchMessage,
    appendAssistantDelta,
    updateLastAssistantMessage,
    updateLastAssistantMetadata,
    setStreaming,
  };
});
