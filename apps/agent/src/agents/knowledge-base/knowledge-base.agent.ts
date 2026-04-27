/**
 * Knowledge Base Agent — 离线/后台 Agent，负责文档入库与向量化
 * 推理模式：Pipeline（直接调用 RAG 服务，不需要 LLM）
 * 通常由管理员操作触发，与对话链路完全解耦
 */

import { BaseAgent } from '../../harness/core/agent.js';
import type { AgentContext } from '../../harness/core/types.js';
import type { LLMClient } from '../../harness/core/llm-client.js';
import type { Observer } from '../../harness/observer/tracer.js';
import type { KnowledgeBaseInput, KnowledgeBaseOutput } from './knowledge-base.types.js';

export class KnowledgeBaseAgent extends BaseAgent<KnowledgeBaseInput, KnowledgeBaseOutput> {
  constructor(
    llm: LLMClient,
    observer: Observer,
    private readonly ragServiceUrl: string,
  ) {
    super(llm, observer);
  }

  async execute(input: KnowledgeBaseInput, _ctx: AgentContext): Promise<KnowledgeBaseOutput> {
    switch (input.action) {
      case 'index_document':
        return this.indexDocument(input);
      case 'index_text':
        return this.indexText(input);
      case 'delete_document':
        return this.deleteDocument(input);
    }
  }

  private async indexDocument(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
    if (!input.fileContentBase64 || !input.filename) {
      return { success: false, message: '缺少文件内容或文件名' };
    }

    const fileBuffer = Buffer.from(input.fileContentBase64, 'base64');
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, input.filename);
    formData.append('knowledge_base_id', input.knowledgeBaseId);
    formData.append('subject_id', input.subjectId);
    formData.append('doc_name', input.docName ?? input.filename);

    const res = await fetch(`${this.ragServiceUrl}/index/upload`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { success: false, message: `RAG 服务返回错误: ${res.status}` };
    }

    const data = (await res.json()) as { doc_id: string; chunks: number };
    return { success: true, docId: data.doc_id, chunkCount: data.chunks };
  }

  private async indexText(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
    if (!input.text) return { success: false, message: '缺少文本内容' };

    const res = await fetch(`${this.ragServiceUrl}/index/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        knowledge_base_id: input.knowledgeBaseId,
        subject_id: input.subjectId,
        doc_name: input.docName ?? 'text_input',
        doc_id: input.docId,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { success: false, message: `RAG 服务返回错误: ${res.status}` };
    }

    const data = (await res.json()) as { doc_id: string; chunks: number };
    return { success: true, docId: data.doc_id, chunkCount: data.chunks };
  }

  private async deleteDocument(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
    if (!input.docId) return { success: false, message: '缺少文档 ID' };

    const res = await fetch(
      `${this.ragServiceUrl}/index/${input.knowledgeBaseId}/${input.docId}`,
      {
        method: 'DELETE',
        signal: AbortSignal.timeout(10_000),
      },
    );

    return { success: res.ok, message: res.ok ? '删除成功' : `删除失败: ${res.status}` };
  }
}
