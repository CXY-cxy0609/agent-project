/**
 * Storage Upload Tool — 上传视频文件至对象存储，返回访问链接
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '../harness/tool/tool.js';

interface StorageUploadResponse {
  data?: {
    url?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export function createStorageUploadTool(serverUrl: string, internalToken: string) {
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
        const fileData = await readFile(input.file_path);
        const form = new FormData();
        form.append('object_key', input.object_key);
        form.append('content_type', input.content_type ?? 'video/mp4');
        form.append('file', new Blob([fileData]), path.basename(input.file_path));

        const res = await fetch(`${serverUrl}/api/storage/upload`, {
          method: 'POST',
          headers: {
            ...(internalToken ? { 'x-internal-token': internalToken } : {}),
          },
          body: form,
          signal: AbortSignal.timeout(600_000),
        });

        if (!res.ok) {
          let errorMessage = `Upload failed: ${res.status}`;
          try {
            const errorData = (await res.json()) as StorageUploadResponse;
            errorMessage = errorData.error?.message
              ? `Upload failed: ${res.status} ${errorData.error.message}`
              : errorMessage;
          } catch {
            // Ignore malformed error bodies; status code is enough for callers.
          }
          return { success: false, error_message: errorMessage };
        }

        const data = (await res.json()) as StorageUploadResponse;
        const url = data.data?.url;
        if (!url) {
          return { success: false, error_message: 'Upload response missing data.url' };
        }
        return { success: true, url };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error_message: msg };
      }
    },
  });
}
