/**
 * Manim Runner Tool — 执行 Manim Python 脚本，渲染数学动画视频
 */

import { defineTool } from '../harness/tool/tool.js';

export interface ManimRunnerResult {
  success: boolean;
  video_path?: string;
  error_message?: string;
  stderr?: string;
}

export function createManimRunnerTool(manimServiceUrl: string) {
  return defineTool<
    { script: string; output_name: string },
    ManimRunnerResult
  >({
    name: 'manim_runner',
    description:
      '执行 Manim Python 脚本，渲染数学讲解动画视频。返回渲染结果或错误信息。',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: '完整的 Manim Python 脚本内容',
        },
        output_name: {
          type: 'string',
          description: '输出视频文件名（不含扩展名）',
        },
      },
      required: ['script', 'output_name'],
    },
    execute: async (input) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000); // 2 分钟超时

      try {
        const res = await fetch(`${manimServiceUrl}/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            script: input.script,
            output_name: input.output_name,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        const data = (await res.json()) as ManimRunnerResult;
        return data;
      } catch (err) {
        clearTimeout(timer);
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error_message: msg };
      }
    },
  });
}
