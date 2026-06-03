import type { ChatStreamEvent, Conversation, Message, ConversationListQuery, MessageAttachment, MessageMetadata, PageResult } from '@tutor/shared';
import type { SendMessagePayload } from '@/api/chat';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, MOCK_STREAM_RESPONSE } from '../data';

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let _conversations = [...MOCK_CONVERSATIONS];
const _messages: Record<string, Message[]> = { ...MOCK_MESSAGES };

export const mockChatApi = {
  async getConversations(params?: ConversationListQuery): Promise<PageResult<Conversation>> {
    await delay();
    let list = [..._conversations];
    if (params?.subjectId) {
      list = list.filter((c) => c.subjectId === params.subjectId);
    }
    if (params?.title) {
      list = list.filter((c) => c.title.includes(params.title!));
    }
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    return { list: list.slice(start, start + pageSize), total: list.length, page, pageSize };
  },

  async getConversation(id: string): Promise<Conversation> {
    await delay(200);
    const conv = _conversations.find((c) => c.id === id);
    if (!conv) throw new Error('会话不存在');
    return { ...conv };
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    await delay();
    return [...(_messages[conversationId] ?? [])];
  },

  async deleteConversation(id: string): Promise<void> {
    await delay();
    _conversations = _conversations.filter((c) => c.id !== id);
    delete _messages[id];
  },

  async createConversation(data: { id?: string; title: string; subjectId?: number; userId?: string }): Promise<Conversation> {
    await delay(150);
    const conversationId = data.id ?? `conv-${Date.now()}`;
    const existing = _conversations.find((item) => item.id === conversationId);
    if (existing) {
      return { ...existing };
    }
    const created: Conversation = {
      id: conversationId,
      title: data.title,
      subjectId: data.subjectId ?? 0,
      subjectName: MOCK_CONVERSATIONS.find((item) => item.subjectId === data.subjectId)?.subjectName ?? '未知学科',
      userId: data.userId ?? 'mock-user-001',
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    _conversations.unshift(created);
    _messages[conversationId] = [];
    return { ...created };
  },

  async updateConversation(data: { id: string; title: string; subjectId?: number }): Promise<Conversation> {
    await delay(100);
    const conv = _conversations.find((item) => item.id === data.id);
    if (!conv) throw new Error('会话不存在');
    conv.title = data.title;
    if (data.subjectId) conv.subjectId = data.subjectId;
    conv.updatedAt = new Date().toISOString();
    return { ...conv };
  },

  async appendMessage(
    conversationId: string,
    data: {
      id?: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      status?: 'pending' | 'streaming' | 'done' | 'error';
      metadata?: MessageMetadata;
      attachments?: MessageAttachment[];
    },
  ): Promise<void> {
    await delay(100);
    if (!_messages[conversationId]) {
      _messages[conversationId] = [];
    }
    _messages[conversationId].push({
      id: data.id ?? `msg-${Date.now()}`,
      conversationId,
      role: data.role,
      content: data.content,
      status: data.status ?? 'done',
      createdAt: new Date().toISOString(),
      metadata: data.metadata,
      attachments: data.attachments,
    });
  },

  sendMessage(
    data: SendMessagePayload,
    onEvent: (event: ChatStreamEvent) => void,
    onError: (err: Error) => void,
  ): () => void {
    let cancelled = false;

    (async () => {
      try {
        await delay(500);
        if (cancelled) return;

        // Create or reuse conversation
        let conv = data.conversationId
          ? _conversations.find((c) => c.id === data.conversationId)
          : undefined;

        if (!conv) {
          conv = {
            id: `conv-${Date.now()}`,
            title: '新对话',
            subjectId: data.subjectId ?? data.availableSubjects?.[0]?.id ?? 0,
            subjectName:
              MOCK_CONVERSATIONS.find((c) => c.subjectId === data.subjectId)?.subjectName ??
              data.availableSubjects?.find((subject) => subject.id === data.subjectId)?.name ??
              '未知学科',
            userId: data.userId ?? 'mock-user-001',
            messageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          _conversations.unshift(conv);
          _messages[conv.id] = [];
        }
        const streamId = `mock-stream-${Date.now()}`;
        let eventSeq = 0;
        const nextSeq = () => ++eventSeq;
        const turnId = data.turnId ?? `turn-${Date.now()}`;

        const userMsg: Message = {
          id: data.userMessageId ?? `msg-${Date.now()}-u`,
          conversationId: conv.id,
          seq: conv.messageCount + 1,
          role: 'user',
          content: data.content,
          status: 'done',
          turnId,
          createdAt: new Date().toISOString(),
          attachments: data.attachments,
        };
        const assistantMsg: Message = {
          id: data.assistantMessageId ?? `msg-${Date.now()}-a`,
          conversationId: conv.id,
          seq: conv.messageCount + 2,
          role: 'assistant',
          content: '',
          status: 'streaming',
          turnId,
          replyToMessageId: userMsg.id,
          createdAt: new Date().toISOString(),
          metadata: { model: data.model ?? 'default' },
        };
        _messages[conv.id].push(userMsg, assistantMsg);
        onEvent({ type: 'start', streamId, sequence: nextSeq(), conversationId: conv.id });
        onEvent({ type: 'conversation.meta', streamId, sequence: nextSeq(), conversation: { ...conv } });
        onEvent({ type: 'message.created', streamId, sequence: nextSeq(), userMessage: { ...userMsg }, assistantMessage: { ...assistantMsg } });
        onEvent({
          type: 'intent',
          streamId,
          sequence: nextSeq(),
          intent: 'qa',
          reasoning: '识别为学习问答，路由到 QA Agent。',
          semanticSummary: data.content,
          title: data.content.slice(0, 24),
          assistantMessageId: assistantMsg.id,
        });

        const words = MOCK_STREAM_RESPONSE.split('');
        let accumulated = '';
        const chunkSize = 5;

        for (let i = 0; i < words.length; i += chunkSize) {
          if (cancelled) return;
          const chunk = words.slice(i, i + chunkSize).join('');
          accumulated += chunk;
          onEvent({ type: 'delta', streamId, sequence: nextSeq(), assistantMessageId: assistantMsg.id, delta: chunk });
          await delay(30);
        }

        if (cancelled) return;

        if ((data.messageCount ?? conv.messageCount) <= 0) {
          conv.title = data.content.slice(0, 24);
        }
        assistantMsg.content = accumulated;
        assistantMsg.status = 'done';
        assistantMsg.metadata = {
          ...assistantMsg.metadata,
          tokens: 128,
          thoughtChain: [{ title: '意图识别', content: '识别为学习问答，路由到 QA Agent。', status: 'done' }],
        };
        conv.messageCount += 2;
        conv.updatedAt = new Date().toISOString();
        onEvent({ type: 'message.finalized', streamId, sequence: nextSeq(), assistantMessage: { ...assistantMsg }, metadata: assistantMsg.metadata });
        onEvent({ type: 'conversation.meta', streamId, sequence: nextSeq(), conversation: { ...conv } });
        onEvent({ type: 'done', streamId, sequence: nextSeq(), conversationId: conv.id });
      } catch (err) {
        if (!cancelled) onError(err as Error);
      }
    })();

    return () => { cancelled = true; };
  },

  async uploadAttachment(_file: File): Promise<MessageAttachment> {
    await delay(800);
    const isImage = _file.type.startsWith('image/');
    if (!isImage) {
      throw new Error('当前对话页暂只支持上传图片');
    }
    const url = URL.createObjectURL(_file);
    return {
      id: `att-${Date.now()}`,
      url,
      thumbnailUrl: isImage ? url : undefined,
      name: _file.name || 'attachment',
      type: 'image',
      size: _file.size,
      mimeType: _file.type || 'application/octet-stream',
      status: 'done',
    };
  },

  async getVideoProgress(_taskId: string): Promise<{ percent: number; status: string; description: string; videoUrl?: string }> {
    await delay(500);
    return { percent: 100, status: 'done', description: '视频生成完成', videoUrl: '/mock/video/sample.mp4' };
  },
};
