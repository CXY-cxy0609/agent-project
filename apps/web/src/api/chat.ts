import http from './http';
import type { Conversation, Message, ConversationListQuery, PageResult } from '@kaoyan/shared';
import { USE_MOCK } from '@/mock/config';
import { mockChatApi } from '@/mock/handlers/chat';

const realChatApi = {
  getConversations: (params?: ConversationListQuery) =>
    http.get<PageResult<Conversation>, PageResult<Conversation>>('/conversations', { params }),

  getConversation: (id: string) =>
    http.get<Conversation, Conversation>(`/conversations/${id}`),

  getMessages: (conversationId: string) =>
    http.get<Message[], Message[]>(`/conversations/${conversationId}/messages`),

  deleteConversation: (id: string) =>
    http.delete(`/conversations/${id}`),

  sendMessage(
    data: { conversationId?: string; subjectId: string; content: string; model: string; generateVideo?: boolean },
    onChunk: (text: string) => void,
    onDone: (conversation: Conversation) => void,
    onError: (err: Error) => void,
  ) {
    const ctrl = new AbortController();
    fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('kaoyan-auth') ? JSON.parse(localStorage.getItem('kaoyan-auth')!).token?.accessToken : ''}`,
      },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim();
              if (payload === '[DONE]') {
                onDone({} as Conversation);
              } else {
                try {
                  const parsed = JSON.parse(payload);
                  if (parsed.type === 'text') onChunk(parsed.content);
                  if (parsed.type === 'done') onDone(parsed.conversation);
                } catch {}
              }
            }
          }
        }
      })
      .catch(onError);
    return () => ctrl.abort();
  },

  uploadAttachment: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.post<{ url: string; name: string }, { url: string; name: string }>('/chat/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getVideoProgress: (taskId: string) =>
    http.get<{ percent: number; status: string; description: string; videoUrl?: string }, { percent: number; status: string; description: string; videoUrl?: string }>(
      `/chat/video-progress/${taskId}`,
    ),
};

export const chatApi = USE_MOCK ? mockChatApi : realChatApi;
