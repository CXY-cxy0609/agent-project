/**
 * Manim Runner Tool — 执行 Manim Python 脚本，渲染数学动画视频
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { defineTool } from '../harness/tool/tool.js';

export interface ManimRunnerResult {
  success: boolean;
  video_path?: string;
  error_message?: string;
  stderr?: string;
}

const RENDER_TIMEOUT_MS = 1_200_000;

export function createManimRunnerTool(manimProjectDir?: string) {
  return defineTool<
    { script?: string; script_path?: string; output_name: string },
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
        script_path: {
          type: 'string',
          description: '已写入磁盘的 Manim Python 脚本路径，优先使用',
        },
        output_name: {
          type: 'string',
          description: '输出视频文件名（不含扩展名）',
        },
      },
      required: ['output_name'],
    },
    execute: async (input) => {
      try {
        const projectDir = await resolveManimProjectDir(manimProjectDir);
        const scriptPath = await resolveScriptPath(projectDir, input);
        const mediaDir = path.join(path.dirname(scriptPath), '..', 'render', 'media');
        await fs.mkdir(mediaDir, { recursive: true });

        console.log(`[MANIM_RUNNER] project_dir=${projectDir}`);
        console.log(`[MANIM_RUNNER] script_path=${scriptPath}`);

        const command = [
          `source ${shellQuote(path.join(projectDir, '.venv', 'bin', 'activate'))}`,
          [
            'manim',
            shellQuote(scriptPath),
            '-o',
            shellQuote(input.output_name),
            '--media_dir',
            shellQuote(mediaDir),
          ].join(' '),
        ].join(' && ');
        console.log(`[MANIM_RUNNER] command=${command}`);
        console.log('[MANIM_RUNNER] render_output_start');

        const result = await runShellCommand(command, {
          cwd: projectDir,
          env: {
            ...process.env,
            VIRTUAL_ENV: path.join(projectDir, '.venv'),
            PATH: `${path.join(projectDir, '.venv', 'bin')}:${process.env.PATH ?? ''}`,
            PYTHONPATH: [projectDir, process.env.PYTHONPATH].filter(Boolean).join(':'),
          },
          timeoutMs: RENDER_TIMEOUT_MS,
        });
        console.log('[MANIM_RUNNER] render_output_end');

        if (result.exitCode !== 0) {
          const output = result.output || `manim exited with ${result.exitCode}`;
          return {
            success: false,
            error_message: tail(output, 500),
            stderr: output,
          };
        }

        const videoPath = await findRenderedVideo(mediaDir, input.output_name);
        if (!videoPath) {
          const output = result.output || 'Manim rendered successfully but no mp4 output was found';
          return {
            success: false,
            error_message: tail(output, 500),
            stderr: output,
          };
        }

        return { success: true, video_path: videoPath, stderr: result.output };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error_message: msg };
      }
    },
  });
}

async function resolveManimProjectDir(configuredDir?: string): Promise<string> {
  const candidates = [
    configuredDir ? path.resolve(configuredDir) : undefined,
    path.resolve(process.cwd(), '../manim-project'),
    path.resolve(process.cwd(), 'apps/manim-project'),
  ].filter((item): item is string => Boolean(item));

  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, '.venv', 'bin', 'python'));
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(`Manim virtualenv not found. Tried: ${candidates.join(', ')}`);
}

async function resolveScriptPath(
  projectDir: string,
  input: { script?: string; script_path?: string; output_name: string },
): Promise<string> {
  if (input.script_path) return path.resolve(input.script_path);
  if (!input.script?.trim()) throw new Error('Manim script or script_path is required');
  const scriptPath = path.join(projectDir, '.temp-project', 'adhoc', `${input.output_name}.py`);
  await fs.mkdir(path.dirname(scriptPath), { recursive: true });
  await fs.writeFile(scriptPath, input.script, 'utf-8');
  return scriptPath;
}

function runShellCommand(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', ['-lc', command], { cwd: options.cwd, env: options.env });
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(tail(output || `Manim render timed out after ${options.timeoutMs}ms`, 500)));
    }, options.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, output });
    });
  });
}

async function findRenderedVideo(mediaDir: string, outputName: string): Promise<string | undefined> {
  const files = await walkFiles(mediaDir);
  const mp4Files = files.filter((file) => file.endsWith('.mp4'));
  const exact = mp4Files.find((file) => path.basename(file, '.mp4') === outputName);
  if (exact) return exact;
  const stats = await Promise.all(mp4Files.map(async (file) => ({ file, stat: await fs.stat(file) })));
  return stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0]?.file;
}

async function walkFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(absolutePath));
    if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

function tail(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
