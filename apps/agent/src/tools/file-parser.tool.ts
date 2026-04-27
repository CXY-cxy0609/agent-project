/**
 * File Parser Tool — 解析用户上传的 PDF/Markdown 文件，提取文本内容
 * 通过 RAG 服务的文件解析接口处理
 */

import { defineTool } from '../harness/tool/tool.js';

export function createFileParserTool(ragServiceUrl: string) {
  return defineTool<
    { file_content_base64: string; filename: string },
    { extracted_text: string; page_count?: number; success: boolean }
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

        const res = await fetch(`${ragServiceUrl}/parse`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          return { extracted_text: '', success: false };
        }

        const data = (await res.json()) as { text: string; page_count?: number };
        return { extracted_text: data.text, page_count: data.page_count, success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { extracted_text: `文件解析失败: ${msg}`, success: false };
      }
    },
  });
}
