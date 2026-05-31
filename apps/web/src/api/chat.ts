import http from './http';
import type { Conversation, Message, ConversationListQuery, PageResult } from '@tutor/shared';
import { USE_MOCK } from '@/mock/config';
import { mockChatApi } from '@/mock/handlers/chat';

interface ServerConversation {
  id?: string;
  conversation_id?: string;
  title?: string;
  subject_id?: string | number;
  subjectId?: string | number;
  subject_name?: string;
  subjectName?: string;
  user_id?: string;
  userId?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  message_count?: number;
  messageCount?: number;
}

interface SendMessagePayload {
  conversationId?: string;
  subjectId?: number;
  content: string;
  model: string;
  generateVideo?: boolean;
  userId?: string;
  availableSubjects?: Array<{ id: number; name: string; code?: number | string }>;
}

interface PersistMessagePayload {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: 'pending' | 'streaming' | 'done' | 'error';
}

function toNumber(value: unknown, fallback = 0): number {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : fallback;
}

function normalizeConversation(item: ServerConversation): Conversation {
  const createdAt = item.createdAt ?? item.created_at ?? new Date().toISOString();
  const updatedAt = item.updatedAt ?? item.updated_at ?? createdAt;
  const subjectId = toNumber(item.subjectId ?? item.subject_id, 0);
  return {
    id: item.id ?? item.conversation_id ?? '',
    title: item.title ?? '新对话',
    subjectId,
    subjectName: item.subjectName ?? item.subject_name ?? (subjectId ? `学科 ${subjectId}` : '未分配学科'),
    userId: item.userId ?? item.user_id ?? '',
    createdAt,
    updatedAt,
    messageCount: toNumber(item.messageCount ?? item.message_count, 0),
  };
}

function normalizeConversationPage(payload: unknown): PageResult<Conversation> {
  const source = (payload ?? {}) as {
    list?: ServerConversation[];
    total?: number;
    page?: number;
    pageSize?: number;
  };
  const list = Array.isArray(source.list) ? source.list.map(normalizeConversation) : [];
  return {
    list,
    total: typeof source.total === 'number' ? source.total : list.length,
    page: typeof source.page === 'number' ? source.page : 1,
    pageSize: typeof source.pageSize === 'number' ? source.pageSize : 20,
  };
}

const realChatApi = {
  getConversations: (params?: ConversationListQuery) =>
    http
      .get<unknown, unknown>('/conversations', {
        params: {
          ...params,
          subject_id: params?.subjectId,
          page_size: params?.pageSize,
          knowledge_keyword: params?.knowledgeKeyword,
          start_date: params?.startDate,
          end_date: params?.endDate,
        },
      })
      .then(normalizeConversationPage),

  getConversation: (id: string) =>
    http.get<ServerConversation, ServerConversation>(`/conversations/${id}`).then(normalizeConversation),

  getMessages: (conversationId: string) =>
    http
      .get<{ list?: Message[] }, { list?: Message[] }>(`/conversations/${conversationId}/messages`)
      .then((payload) => payload.list ?? []),

  deleteConversation: (id: string) =>
    http.delete(`/conversations/${id}`),

  createConversation: (data: { id: string; title: string; subjectId?: number; userId?: string }) =>
    http.post(`/conversations`, data),

  appendMessage: (conversationId: string, data: PersistMessagePayload) =>
    http.post(`/conversations/${conversationId}/messages`, data),

  sendMessage(
    data: SendMessagePayload,
    onChunk: (text: string) => void,
    onDone: (conversation: Conversation) => void,
    onError: (err: Error) => void,
  ) {
    const ctrl = new AbortController();
    fetch('/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('tutor-auth') ? JSON.parse(localStorage.getItem('tutor-auth')!).token?.accessToken : ''}`,
      },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(`chat stream failed: ${res.status}`);
        }
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let doneNotified = false;
        const fallbackConversation: Conversation = normalizeConversation({
          id: data.conversationId,
          title: data.content.slice(0, 20),
          subject_id: data.subjectId,
          user_id: data.userId ?? '',
        });
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
                if (!doneNotified) {
                  doneNotified = true;
                  onDone(fallbackConversation);
                }
              } else {
                let parsed: any;
                try {
                  parsed = JSON.parse(payload);
                } catch {
                  continue;
                }
                if (parsed.type === 'text' && typeof parsed.content === 'string') {
                  onChunk(parsed.content);
                }
                if (parsed.type === 'reply' && typeof parsed.content === 'string') {
                  onChunk(parsed.content);
                  fallbackConversation.id = parsed.conversationId ?? fallbackConversation.id;
                  fallbackConversation.subjectId = toNumber(parsed.subjectId, fallbackConversation.subjectId);
                  fallbackConversation.subjectName =
                    parsed.subjectName ??
                    (fallbackConversation.subjectId
                      ? `学科 ${fallbackConversation.subjectId}`
                      : fallbackConversation.subjectName);
                  if (!doneNotified) {
                    doneNotified = true;
                    onDone(fallbackConversation);
                  }
                }
                if (parsed.type === 'done' && !doneNotified) {
                  doneNotified = true;
                  onDone(fallbackConversation);
                }
                if (parsed.type === 'error') {
                  throw new Error(parsed.message ?? 'stream error');
                }
              }
            }
          }
        }
        if (!doneNotified) {
          onDone(fallbackConversation);
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
