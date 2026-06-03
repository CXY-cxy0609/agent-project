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
    formData.append('visibility', input.visibility ?? 'public');
    if (input.ownerUserId) formData.append('owner_user_id', input.ownerUserId);
    if (input.parseMode) formData.append('mode', input.parseMode);
    if (typeof input.maxUpgradePages === 'number') {
      formData.append('max_upgrade_pages', String(input.maxUpgradePages));
    }
    if (typeof input.budgetTokens === 'number') {
      formData.append('budget_tokens', String(input.budgetTokens));
    }
    formData.append('wait', 'true');

    const res = await fetch(`${this.ragServiceUrl}/index/upload`, {
      method: 'POST',
      headers: {
        'x-internal-token': process.env.INTERNAL_TOKEN ?? '',
      },
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { success: false, message: `RAG 服务返回错误: ${res.status}` };
    }

    const accepted = (await res.json()) as { task_id: string };
    const taskResult = await this.pollIndexTask(accepted.task_id);
    if (!taskResult?.result) {
      return { success: false, message: '索引任务未返回结果' };
    }
    return {
      success: true,
      docId: String(taskResult.result.doc_id ?? ''),
      chunkCount: Number(taskResult.result.chunks ?? 0),
    };
  }

  private async indexText(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
    if (!input.text) return { success: false, message: '缺少文本内容' };

    const res = await fetch(`${this.ragServiceUrl}/index/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': process.env.INTERNAL_TOKEN ?? '',
      },
      body: JSON.stringify({
        text: input.text,
        knowledge_base_id: input.knowledgeBaseId,
        subject_id: input.subjectId,
        doc_name: input.docName ?? 'text_input',
        visibility: input.visibility ?? 'public',
        owner_user_id: input.ownerUserId,
        doc_id: input.docId,
        wait: true,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      return { success: false, message: `RAG 服务返回错误: ${res.status}` };
    }

    const accepted = (await res.json()) as { task_id: string };
    const taskResult = await this.pollIndexTask(accepted.task_id);
    if (!taskResult?.result) {
      return { success: false, message: '索引任务未返回结果' };
    }
    return {
      success: true,
      docId: String(taskResult.result.doc_id ?? ''),
      chunkCount: Number(taskResult.result.chunks ?? 0),
    };
  }

  private async deleteDocument(input: KnowledgeBaseInput): Promise<KnowledgeBaseOutput> {
    if (!input.docId) return { success: false, message: '缺少文档 ID' };

    const res = await fetch(
      `${this.ragServiceUrl}/index/${input.knowledgeBaseId}/${input.docId}`,
      {
        method: 'DELETE',
        headers: {
          'x-internal-token': process.env.INTERNAL_TOKEN ?? '',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    return { success: res.ok, message: res.ok ? '删除成功' : `删除失败: ${res.status}` };
  }

  private async pollIndexTask(taskId: string): Promise<{ status: string; result?: Record<string, unknown> } | null> {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const res = await fetch(`${this.ragServiceUrl}/index/tasks/${taskId}`, {
        headers: { 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return null;
      }
      const task = (await res.json()) as { status: string; result?: Record<string, unknown>; error?: string };
      if (task.status === 'succeeded') {
        return task;
      }
      if (task.status === 'failed') {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return null;
  }
}
