/**
 * Markdown Prompt Loader — harness/prompt 基础设施的一部分
 *
 * 从 src/prompt/ 目录下的 .md 文件加载 PromptTemplate / OutputSchema / Rules。
 *
 * 文件格式约定：
 *   Prompt 模板文件（persona.md / *.task.md）：
 *     YAML Front Matter 声明元数据，Body 是含 {{var}} 的模板文本。
 *
 *   Schema 文件（*.schema.md）：
 *     YAML Front Matter 中的 fields 数组是机器读取的定义，Body 是人类可读说明。
 *
 *   Rules 文件（*.rules.md）：
 *     YAML Front Matter 中的 rules 数组，Body 是使用说明。
 *
 * 路径解析：
 *   所有相对路径均以 src/prompt/ 为根（内容目录），与本文件所在的 harness/ 无关。
 *   TypeScript 直接运行（tsx）时：loader 在 src/harness/prompt/，向上两级再进 prompt/ 即可。
 *   编译后（dist/）时：同样的相对关系成立，前提是构建时已执行
 *   `cp -r src/prompt dist/prompt`（见 package.json build 脚本）。
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import type { PromptTemplate } from './template.js';
import type { OutputSchema, SchemaField } from '../output/schema-parser.js';

// src/harness/prompt/ → ../../prompt/ → src/prompt/（markdown 内容目录）
const PROMPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../prompt');

// ─── 内部 Front Matter 类型 ───────────────────────────────────────────────────

interface PromptFrontMatter {
  name: string;
  requiredVars?: string[];
  optionalVars?: Record<string, string>;
}

interface SchemaFrontMatter {
  name: string;
  fields: SchemaField[];
}

interface RulesFrontMatter {
  rules: string[];
}

// ─── Front Matter 解析 ────────────────────────────────────────────────────────

function parseFrontMatter<T>(content: string, filePath: string): { meta: T; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`[PromptLoader] Missing YAML front matter in: ${filePath}`);
  }
  const meta = yaml.load(match[1]) as T;
  const body = match[2].trim();
  return { meta, body };
}

function readFile(relativePath: string): string {
  const fullPath = resolve(PROMPT_DIR, relativePath);
  try {
    return readFileSync(fullPath, 'utf-8');
  } catch {
    throw new Error(`[PromptLoader] Cannot read prompt file: ${fullPath}`);
  }
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────

/**
 * 加载 Prompt 模板文件（persona.md / *.task.md）。
 *
 * @param relativePath  相对于 src/prompt/ 的路径，例如 'orchestrator/persona.md'
 * @param staticVars    在加载时（非渲染时）预先替换的变量，常用于注入 rules 等静态内容
 */
export function loadPrompt(
  relativePath: string,
  staticVars?: Record<string, string>,
): PromptTemplate {
  const content = readFile(relativePath);
  const { meta, body } = parseFrontMatter<PromptFrontMatter>(content, relativePath);

  // 静态变量在加载时替换（如 {{rules}}），动态变量留待 PromptRenderer 运行时处理
  let template = body;
  if (staticVars) {
    for (const [key, value] of Object.entries(staticVars)) {
      template = template.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  return {
    name: meta.name,
    template,
    requiredVars: meta.requiredVars ?? [],
    optionalVars: meta.optionalVars,
  };
}

/**
 * 加载 Schema 文件（*.schema.md）。
 * Schema 定义来自 YAML Front Matter 的 fields 数组，Body 仅作人类文档用。
 *
 * @param relativePath  相对于 src/prompt/ 的路径，例如 'orchestrator/intent-output.schema.md'
 */
export function loadSchema(relativePath: string): OutputSchema {
  const content = readFile(relativePath);
  const { meta } = parseFrontMatter<SchemaFrontMatter>(content, relativePath);
  return { fields: meta.fields };
}

/**
 * 加载 Rules 文件（*.rules.md），返回规则字符串数组。
 *
 * @param relativePath  相对于 src/prompt/ 的路径，例如 'shared/global.rules.md'
 */
export function loadRules(relativePath: string): readonly string[] {
  const content = readFile(relativePath);
  const { meta } = parseFrontMatter<RulesFrontMatter>(content, relativePath);
  return Object.freeze(meta.rules ?? []);
}
