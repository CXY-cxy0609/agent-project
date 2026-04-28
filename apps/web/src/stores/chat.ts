import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Conversation, Message } from '@tutor/shared';

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

  function setActiveConversation(id: string | null) {
    activeConversationId.value = id;
    if (id === null) messages.value = [];
  }

  function setMessages(list: Message[]) {
    messages.value = list;
  }

  function appendMessage(msg: Message) {
    messages.value.push(msg);
  }

  function updateLastAssistantMessage(content: string, done = false) {
    const last = messages.value.findLast((m) => m.role === 'assistant');
    if (last) {
      last.content = content;
      last.status = done ? 'done' : 'streaming';
    }
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
    setActiveConversation,
    setMessages,
    appendMessage,
    updateLastAssistantMessage,
    setStreaming,
  };
});
