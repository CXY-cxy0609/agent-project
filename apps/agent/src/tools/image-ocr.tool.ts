/**
 * Image OCR Tool — 面向 RAG/资料入库的图片文字提取能力。
 * QA 对话不调用该工具；用户上传图片问答时由多模态模型直接看图。
 */

import { defineTool } from '../harness/tool/tool.js';
import type { LLMClient } from '../harness/core/llm-client.js';

export function createImageOcrTool(llm: LLMClient, model: string) {
  return defineTool<
    { image_url: string },
    { extracted_text: string; success: boolean }
  >({
    name: 'image_ocr',
    description:
      '识别图片 URL 中的文字内容（包括题目、公式、表格等）。仅用于 RAG/资料入库等需要 OCR 的离线处理链路。',
    inputSchema: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: '公网可访问的图片 URL',
        },
      },
      required: ['image_url'],
    },
    execute: async (input) => {
      try {
        const response = await llm.call({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'url',
                    url: input.image_url,
                  },
                },
                {
                  type: 'text',
                  text: '请完整提取图片中的所有文字内容，包括题目、选项、公式（用 LaTeX 格式）等。只输出提取的文字，不要添加任何解释。',
                },
              ],
            },
          ],
          maxTokens: 2000,
        });

        return { extracted_text: response.content, success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { extracted_text: `OCR 失败: ${msg}`, success: false };
      }
    },
  });
}
