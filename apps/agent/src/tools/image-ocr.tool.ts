/**
 * Image OCR Tool — 处理用户上传的图片，提取文字内容
 * 利用 Claude 的多模态能力直接识别图片，无需外部 OCR 服务
 */

import { defineTool } from '../harness/tool/tool.js';
import { LLMClient } from '../harness/core/llm-client.js';
import { MODELS } from '../constants/models.js';

export function createImageOcrTool(llm: LLMClient) {
  return defineTool<
    { image_base64: string; media_type: string },
    { extracted_text: string; success: boolean }
  >({
    name: 'image_ocr',
    description:
      '识别图片中的文字内容（包括题目、公式、表格等）。用户上传图片时，先调用此工具提取文字，再进行后续处理。',
    inputSchema: {
      type: 'object',
      properties: {
        image_base64: {
          type: 'string',
          description: 'Base64 编码的图片内容',
        },
        media_type: {
          type: 'string',
          description: '图片 MIME 类型，如 image/jpeg、image/png',
          enum: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        },
      },
      required: ['image_base64', 'media_type'],
    },
    execute: async (input) => {
      try {
        const response = await llm.call({
          model: MODELS.HAIKU,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: input.media_type as 'image/jpeg',
                    data: input.image_base64,
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
