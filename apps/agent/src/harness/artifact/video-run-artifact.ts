import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_TEMP_PROJECT_ROOT = path.resolve(process.cwd(), '../manim-project/.temp-project');

export interface VideoRunArtifactContext {
  runId: string;
  workflowId: string;
  traceId: string;
  rootDir: string;
  runDir: string;
  objectPrefix: string;
  createdAt: string;
}

export interface FileManifestItem {
  file: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string;
}

export interface RunManifest {
  runId: string;
  workflowId: string;
  traceId: string;
  createdAt: string;
  files: FileManifestItem[];
}

function normalizeId(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function utcDateParts(now: Date): { yyyy: string; mm: string; dd: string } {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return { yyyy, mm, dd };
}

async function walkFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(absolutePath);
      files.push(...nested);
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

async function sha256OfFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return createHash('sha256').update(data).digest('hex');
}

export async function initVideoRunArtifactContext(params: {
  workflowId: string;
  traceId: string;
  baseDir?: string;
}): Promise<VideoRunArtifactContext> {
  const now = new Date();
  const createdAt = now.toISOString();
  const { yyyy, mm, dd } = utcDateParts(now);
  const safeWorkflowId = normalizeId(params.workflowId);
  const safeTraceId = normalizeId(params.traceId);
  const runId = `vrun_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const rootDir = params.baseDir ?? DEFAULT_TEMP_PROJECT_ROOT;
  const runDir = path.join(rootDir, `${yyyy}${mm}${dd}`, `${safeWorkflowId}_${safeTraceId}_${runId}`);
  const objectPrefix = `video-runs/${yyyy}/${mm}/${dd}/${safeWorkflowId}/${safeTraceId}/${runId}`;

  await fs.mkdir(path.join(runDir, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(runDir, 'render'), { recursive: true });

  return {
    runId,
    workflowId: params.workflowId,
    traceId: params.traceId,
    rootDir,
    runDir,
    objectPrefix,
    createdAt,
  };
}

export async function writeRunJson(
  runDir: string,
  relativeFilePath: string,
  payload: unknown,
): Promise<void> {
  const absolutePath = path.join(runDir, relativeFilePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

export async function writeRunText(
  runDir: string,
  relativeFilePath: string,
  content: string,
): Promise<void> {
  const absolutePath = path.join(runDir, relativeFilePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, 'utf-8');
}

export async function finalizeRunManifest(context: VideoRunArtifactContext): Promise<RunManifest> {
  const files = await walkFiles(context.runDir);
  const filtered = files
    .filter((filePath) => path.basename(filePath) !== 'manifest.json')
    .sort((a, b) => a.localeCompare(b));

  const fileItems: FileManifestItem[] = [];
  for (const absolutePath of filtered) {
    const stat = await fs.stat(absolutePath);
    fileItems.push({
      file: path.relative(context.runDir, absolutePath),
      sizeBytes: stat.size,
      sha256: await sha256OfFile(absolutePath),
      modifiedAt: stat.mtime.toISOString(),
    });
  }

  const manifest: RunManifest = {
    runId: context.runId,
    workflowId: context.workflowId,
    traceId: context.traceId,
    createdAt: context.createdAt,
    files: fileItems,
  };
  await writeRunJson(context.runDir, 'manifest.json', manifest);
  return manifest;
}

export async function createRunBundleArchive(context: VideoRunArtifactContext): Promise<string> {
  const archivePath = `${context.runDir}.tar.gz`;
  await execFileAsync('tar', ['-czf', archivePath, '-C', path.dirname(context.runDir), path.basename(context.runDir)]);
  return archivePath;
}

