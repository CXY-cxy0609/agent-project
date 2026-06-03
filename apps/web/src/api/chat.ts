import http from './http';
import type { ChatStreamEvent, Conversation, Message, ConversationListQuery, MessageAttachment, PageResult } from '@tutor/shared';
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

interface CreateConversationPayload {
  conversation?: ServerConversation;
}

export interface SendMessagePayload {
  conversationId?: string;
  subjectId?: number;
  content: string;
  messageCount?: number;
  model?: string;
  generateVideo?: boolean;
  userId?: string;
  images?: Array<{ url: string; mediaType?: string }>;
  attachments?: MessageAttachment[];
  turnId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  availableSubjects?: Array<{ id: number; name: string; code?: number | string }>;
}

interface PersistMessagePayload {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  turnId?: string;
  replyToMessageId?: string;
  status?: 'pending' | 'streaming' | 'done' | 'error';
  metadata?: Record<string, unknown>;
  attachments?: MessageAttachment[];
}

interface UploadAttachmentPayload {
  attachment?: MessageAttachment;
}

interface ChatApi {
  getConversations: (params?: ConversationListQuery) => Promise<PageResult<Conversation>>;
  getConversation: (id: string) => Promise<Conversation>;
  getMessages: (conversationId: string) => Promise<Message[]>;
  deleteConversation: (id: string) => Promise<unknown>;
  createConversation: (data: { id?: string; title: string; subjectId?: number; userId?: string }) => Promise<Conversation>;
  updateConversation: (data: { id: string; title: string; subjectId?: number }) => Promise<Conversation>;
  appendMessage: (conversationId: string, data: PersistMessagePayload) => Promise<unknown>;
  sendMessage: (
    data: SendMessagePayload,
    onEvent: (event: ChatStreamEvent) => void,
    onError: (err: Error) => void,
  ) => () => void;
  uploadAttachment: (file: File) => Promise<MessageAttachment>;
  getVideoProgress: (taskId: string) => Promise<{ percent: number; status: string; description: string; videoUrl?: string }>;
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

const realChatApi: ChatApi = {
  getConversations: (params?: ConversationListQuery) =>
    http
      .post<unknown, unknown>('/conversations/list', {
        ...params,
      })
      .then(normalizeConversationPage),

  getConversation: (id: string) =>
    http.post<ServerConversation, ServerConversation>('/conversations/detail', { id }).then(normalizeConversation),

  getMessages: (conversationId: string) =>
    http
      .post<{ list?: Message[] }, { list?: Message[] }>('/conversations/messages/list', { id: conversationId })
      .then((payload) => payload.list ?? []),

  deleteConversation: (id: string) =>
    http.post('/conversations/delete', { id }),

  createConversation: (data: { id?: string; title: string; subjectId?: number; userId?: string }) =>
    http
      .post<CreateConversationPayload, CreateConversationPayload>('/conversations', data)
      .then((payload) => normalizeConversation(payload.conversation ?? {})),

  updateConversation: (data: { id: string; title: string; subjectId?: number }) =>
    http
      .post<CreateConversationPayload, CreateConversationPayload>('/conversations/update', data)
      .then((payload) => normalizeConversation(payload.conversation ?? {})),

  appendMessage: (conversationId: string, data: PersistMessagePayload) =>
    http.post('/conversations/messages/create', { conversationId, ...data }),

  sendMessage(
    data: SendMessagePayload,
    onEvent: (event: ChatStreamEvent) => void,
    onError: (err: Error) => void,
  ) {
    const ctrl = new AbortController();
    const token = getAccessToken();

    fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const payload = line.slice(6).trim();
              if (payload !== '[DONE]') {
                let parsed: any;
                try {
                  parsed = JSON.parse(payload);
                } catch {
                  continue;
                }
                if (parsed.type === 'error') {
                  throw new Error(parsed.message ?? 'stream error');
                }
                onEvent(parsed as ChatStreamEvent);
              }
            }
          }
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        onError(error instanceof Error ? error : new Error('chat stream failed'));
      });
    return () => ctrl.abort();
  },

  uploadAttachment: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<UploadAttachmentPayload, UploadAttachmentPayload>('/chat/attachments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((payload) => {
        if (!payload.attachment) {
          throw new Error('attachment upload response missing attachment');
        }
        return payload.attachment;
      });
  },

  getVideoProgress: (taskId: string) =>
    http.get<{ percent: number; status: string; description: string; videoUrl?: string }, { percent: number; status: string; description: string; videoUrl?: string }>(
      `/chat/video-progress/${taskId}`,
    ),
};

export const chatApi: ChatApi = USE_MOCK ? (mockChatApi as ChatApi) : realChatApi;

function getAccessToken(): string {
  const raw = localStorage.getItem('tutor-auth');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { token?: { accessToken?: string } };
    return parsed.token?.accessToken ?? '';
  } catch {
    return '';
  }
}
