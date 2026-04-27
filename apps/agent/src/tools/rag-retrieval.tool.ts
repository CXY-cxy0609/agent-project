/**
 * RAG Retrieval Tool — 供 QA Agent 调用的知识库检索工具
 */

import { defineTool } from '../harness/tool/tool.js';
import { RagClient } from '../harness/rag-client/rag-client.js';

export function createRagRetrievalTool(ragClient: RagClient) {
  return defineTool<
    { query: string; subject_id: string; knowledge_base_id?: string; top_k?: number },
    { context: string; has_results: boolean }
  >({
    name: 'rag_retrieval',
    description:
      '从知识库中检索与问题相关的文档片段。当需要回答知识点问题或解题时，应先调用此工具获取参考资料。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '检索查询语句，通常为用户的问题或关键知识点描述',
        },
        subject_id: {
          type: 'string',
          description: '科目标识，如 math、english、politics 等',
        },
        knowledge_base_id: {
          type: 'string',
          description: '（可选）指定知识库 ID，不填则检索该科目所有知识库',
        },
        top_k: {
          type: 'number',
          description: '返回的最相关片段数量，默认 5',
        },
      },
      required: ['query', 'subject_id'],
    },
    execute: async (input) => {
      const result = await ragClient.retrieve(input.query, {
        subjectId: input.subject_id,
        knowledgeBaseId: input.knowledge_base_id,
        topK: input.top_k ?? 5,
      });

      return {
        context: result.context,
        has_results: result.context.trim().length > 0,
      };
    },
  });
}
