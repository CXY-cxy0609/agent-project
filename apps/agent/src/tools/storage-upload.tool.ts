/**
 * Storage Upload Tool — 上传视频文件至对象存储，返回访问链接
 */

import { defineTool } from '../harness/tool/tool.js';

export function createStorageUploadTool(storageServiceUrl: string) {
  return defineTool<
    { file_path: string; object_key: string; content_type?: string },
    { success: boolean; url?: string; error_message?: string }
  >({
    name: 'storage_upload',
    description:
      '将本地文件上传至对象存储（S3/MinIO/OSS），返回可公开访问的 URL。',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: '待上传文件的本地路径',
        },
        object_key: {
          type: 'string',
          description: '对象存储中的目标路径，如 videos/lesson-001.mp4',
        },
        content_type: {
          type: 'string',
          description: '文件 MIME 类型，默认 video/mp4',
        },
      },
      required: ['file_path', 'object_key'],
    },
    execute: async (input) => {
      try {
        const res = await fetch(`${storageServiceUrl}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_path: input.file_path,
            object_key: input.object_key,
            content_type: input.content_type ?? 'video/mp4',
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (!res.ok) {
          return { success: false, error_message: `Upload failed: ${res.status}` };
        }

        const data = (await res.json()) as { url: string };
        return { success: true, url: data.url };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error_message: msg };
      }
    },
  });
}
