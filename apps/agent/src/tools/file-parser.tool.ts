/**
 * File Parser Tool — 解析用户上传的 PDF/Markdown 文件，提取文本内容
 * 通过 RAG 服务的文件解析接口处理
 */

import { defineTool } from '../harness/tool/tool.js';

type ParseMode = 'fast' | 'balanced' | 'quality';

export function createFileParserTool(ragServiceUrl: string) {
  return defineTool<
    {
      file_content_base64: string;
      filename: string;
      mode?: ParseMode;
      max_upgrade_pages?: number;
      budget_tokens?: number;
    },
    {
      extracted_text: string;
      page_count?: number;
      success: boolean;
      parse_profile?: Record<string, unknown>;
      page_signals?: Array<Record<string, unknown>>;
    }
  >({
    name: 'file_parser',
    description:
      '解析用户上传的 PDF 或 Markdown 文件，提取纯文本内容。用于处理题目扫描件或参考资料。',
    inputSchema: {
      type: 'object',
      properties: {
        file_content_base64: {
          type: 'string',
          description: 'Base64 编码的文件内容',
        },
        filename: {
          type: 'string',
          description: '文件名（含扩展名），用于判断文件类型',
        },
        mode: {
          type: 'string',
          description: '解析模式：fast（低成本）/ balanced（默认）/ quality（高质量）',
          enum: ['fast', 'balanced', 'quality'],
        },
        max_upgrade_pages: {
          type: 'number',
          description: '图片型文档最大升级页数（可选）',
        },
        budget_tokens: {
          type: 'number',
          description: '图片型文档解析预算 token（可选）',
        },
      },
      required: ['file_content_base64', 'filename'],
    },
    execute: async (input) => {
      try {
        const fileBuffer = Buffer.from(input.file_content_base64, 'base64');
        const formData = new FormData();
        const blob = new Blob([fileBuffer]);
        formData.append('file', blob, input.filename);
        formData.append('parse_only', 'true');
        if (input.mode) formData.append('mode', input.mode);
        if (typeof input.max_upgrade_pages === 'number') {
          formData.append('max_upgrade_pages', String(input.max_upgrade_pages));
        }
        if (typeof input.budget_tokens === 'number') {
          formData.append('budget_tokens', String(input.budget_tokens));
        }

        const res = await fetch(`${ragServiceUrl}/parse`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          return { extracted_text: '', success: false };
        }

        const data = (await res.json()) as {
          text: string;
          page_count?: number;
          parse_profile?: Record<string, unknown>;
          page_signals?: Array<Record<string, unknown>>;
        };
        return {
          extracted_text: data.text,
          page_count: data.page_count,
          parse_profile: data.parse_profile,
          page_signals: data.page_signals,
          success: true,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { extracted_text: `文件解析失败: ${msg}`, success: false };
      }
    },
  });
}
