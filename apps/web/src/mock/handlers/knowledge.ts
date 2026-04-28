import type { KnowledgeBase, KnowledgeFile, CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto, KnowledgeBaseQuery } from '@tutor/shared';
import { MOCK_KNOWLEDGE_BASES } from '../data';

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let _bases: KnowledgeBase[] = JSON.parse(JSON.stringify(MOCK_KNOWLEDGE_BASES));

export const mockKnowledgeApi = {
  async getKnowledgeBases(params?: KnowledgeBaseQuery): Promise<KnowledgeBase[]> {
    await delay();
    let list = [..._bases];
    if (params?.subjectId) list = list.filter((b) => b.subjectId === params.subjectId);
    if (params?.type) list = list.filter((b) => b.type === params.type);
    if (params?.name) list = list.filter((b) => b.name.includes(params.name!));
    return list;
  },

  async getKnowledgeBase(id: string): Promise<KnowledgeBase> {
    await delay(200);
    const base = _bases.find((b) => b.id === id);
    if (!base) throw new Error('知识库不存在');
    return { ...base };
  },

  async createKnowledgeBase(data: CreateKnowledgeBaseDto): Promise<KnowledgeBase> {
    await delay();
    const newBase: KnowledgeBase = {
      id: `kb-${Date.now()}`,
      ...data,
      subjectName: '未知学科',
      userId: 'mock-user-001',
      files: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    _bases.push(newBase);
    return newBase;
  },

  async updateKnowledgeBase(id: string, data: UpdateKnowledgeBaseDto): Promise<KnowledgeBase> {
    await delay();
    const idx = _bases.findIndex((b) => b.id === id);
    if (idx !== -1) {
      _bases[idx] = { ..._bases[idx], ...data, updatedAt: new Date().toISOString() };
    }
    return { ..._bases[idx] };
  },

  async deleteKnowledgeBase(id: string): Promise<void> {
    await delay();
    _bases = _bases.filter((b) => b.id !== id);
  },

  async uploadFile(knowledgeBaseId: string, file: File): Promise<KnowledgeFile> {
    await delay(800);
    const base = _bases.find((b) => b.id === knowledgeBaseId);
    const newFile: KnowledgeFile = {
      id: `kf-${Date.now()}`,
      knowledgeBaseId,
      name: file.name,
      displayName: file.name,
      type: file.name.endsWith('.pdf') ? 'pdf' : 'md',
      url: `/mock/files/${file.name}`,
      size: file.size,
      order: (base?.files.length ?? 0) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (base) {
      base.files.push(newFile);
      base.updatedAt = new Date().toISOString();
    }
    return newFile;
  },

  async updateFile(
    knowledgeBaseId: string,
    fileId: string,
    data: { displayName?: string; content?: string; order?: number },
  ): Promise<KnowledgeFile> {
    await delay();
    const base = _bases.find((b) => b.id === knowledgeBaseId);
    const fileIdx = base?.files.findIndex((f) => f.id === fileId) ?? -1;
    if (base && fileIdx !== -1) {
      base.files[fileIdx] = { ...base.files[fileIdx], ...data, updatedAt: new Date().toISOString() };
      return { ...base.files[fileIdx] };
    }
    throw new Error('文件不存在');
  },

  async deleteFile(knowledgeBaseId: string, fileId: string): Promise<void> {
    await delay();
    const base = _bases.find((b) => b.id === knowledgeBaseId);
    if (base) base.files = base.files.filter((f) => f.id !== fileId);
  },

  async reorderFiles(knowledgeBaseId: string, fileIds: string[]): Promise<void> {
    await delay();
    const base = _bases.find((b) => b.id === knowledgeBaseId);
    if (base) {
      fileIds.forEach((id, order) => {
        const file = base.files.find((f) => f.id === id);
        if (file) file.order = order + 1;
      });
    }
  },

  async getFileContent(knowledgeBaseId: string, fileId: string): Promise<{ content: string }> {
    await delay(300);
    const base = _bases.find((b) => b.id === knowledgeBaseId);
    const file = base?.files.find((f) => f.id === fileId);
    return { content: file?.content ?? '（Mock 模式：此处为文件内容占位符）' };
  },
};
