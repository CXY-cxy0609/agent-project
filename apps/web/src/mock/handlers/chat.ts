import type { Conversation, Message, ConversationListQuery, PageResult } from '@kaoyan/shared';
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

  sendMessage(
    data: { conversationId?: string; subjectId: string; content: string; model: string; generateVideo?: boolean },
    onChunk: (text: string) => void,
    onDone: (conversation: Conversation) => void,
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
            title: data.content.slice(0, 30),
            subjectId: data.subjectId,
            subjectName: MOCK_CONVERSATIONS.find((c) => c.subjectId === data.subjectId)?.subjectName ?? '未知学科',
            userId: 'mock-user-001',
            messageCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          _conversations.unshift(conv);
          _messages[conv.id] = [];
        }

        // Add user message
        const userMsg: Message = {
          id: `msg-${Date.now()}-u`,
          conversationId: conv.id,
          role: 'user',
          content: data.content,
          status: 'done',
          createdAt: new Date().toISOString(),
        };
        _messages[conv.id].push(userMsg);

        // Stream the response in small chunks
        const words = MOCK_STREAM_RESPONSE.split('');
        let accumulated = '';
        const chunkSize = 5;

        for (let i = 0; i < words.length; i += chunkSize) {
          if (cancelled) return;
          accumulated += words.slice(i, i + chunkSize).join('');
          onChunk(accumulated);
          await delay(30);
        }

        if (cancelled) return;

        // Add assistant message to store
        const assistantMsg: Message = {
          id: `msg-${Date.now()}-a`,
          conversationId: conv.id,
          role: 'assistant',
          content: MOCK_STREAM_RESPONSE,
          status: 'done',
          createdAt: new Date().toISOString(),
          metadata: { model: data.model, tokens: 128 },
        };
        _messages[conv.id].push(assistantMsg);
        conv.messageCount += 2;
        conv.updatedAt = new Date().toISOString();

        onDone({ ...conv });
      } catch (err) {
        if (!cancelled) onError(err as Error);
      }
    })();

    return () => { cancelled = true; };
  },

  async uploadAttachment(_file: File): Promise<{ url: string; name: string }> {
    await delay(800);
    return { url: '/mock/files/upload-placeholder.pdf', name: _file.name };
  },

  async getVideoProgress(_taskId: string): Promise<{ percent: number; status: string; description: string; videoUrl?: string }> {
    await delay(500);
    return { percent: 100, status: 'done', description: '视频生成完成', videoUrl: '/mock/video/sample.mp4' };
  },
};
