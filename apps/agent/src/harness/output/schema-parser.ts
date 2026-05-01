/**
 * YAML Schema 结构化输出解析器
 * LLM 输出 YAML 比 JSON 格式错误率更低，且支持多行字符串（LaTeX、代码块等）
 */

import yaml from 'js-yaml';

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  enum?: string[];
}

export interface OutputSchema {
  fields: SchemaField[];
}

export class SchemaParser {
  /** 将 Schema 序列化成注入 Prompt 的说明文字 */
  toPromptInstruction(schema: OutputSchema): string {
    const fieldDescriptions = schema.fields
      .map((f) => {
        const parts = [`- ${f.name} (${f.type}${f.required ? ', required' : ', optional'}): ${f.description}`];
        if (f.enum) parts.push(`  取值范围: ${f.enum.join(' | ')}`);
        return parts.join('\n');
      })
      .join('\n');

    return `## 输出要求

请严格按照以下 YAML 格式输出，不要输出其他内容：

\`\`\`yaml
${schema.fields.map((f) => `${f.name}: <${f.type}>`).join('\n')}
\`\`\`

字段说明：
${fieldDescriptions}`;
  }

  /** 从 LLM 原始输出中提取 YAML 块 */
  extractYaml(rawOutput: string): string {
    const yamlBlockMatch = rawOutput.match(/```ya?ml\s*([\s\S]*?)```/i);
    if (yamlBlockMatch) return yamlBlockMatch[1].trim();

    // 如果没有代码块包裹，假设整个输出就是 YAML
    return rawOutput.trim();
  }

  /** 解析 LLM 输出的 YAML 字符串，验证 Schema 合规性 */
  parse<T>(yamlString: string, schema: OutputSchema): T {
    const extracted = this.extractYaml(yamlString);

    let parsed: unknown;
    try {
      parsed = yaml.load(extracted);
    } catch (err) {
      throw new ParseError(
        `YAML 解析失败: ${err instanceof Error ? err.message : String(err)}`,
        extracted,
      );
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new ParseError('解析结果不是对象', extracted);
    }

    const obj = parsed as Record<string, unknown>;

    for (const field of schema.fields) {
      if (field.required && !(field.name in obj)) {
        throw new ParseError(`缺少必填字段: ${field.name}`, extracted);
      }

      if (field.name in obj) {
        const value = obj[field.name];
        if (!this.validateType(value, field.type)) {
          throw new ParseError(
            `字段 "${field.name}" 类型错误，期望 ${field.type}，实际: ${typeof value}`,
            extracted,
          );
        }

        if (field.enum && typeof value === 'string' && !field.enum.includes(value)) {
          throw new ParseError(
            `字段 "${field.name}" 值 "${value}" 不在允许范围: ${field.enum.join(', ')}`,
            extracted,
          );
        }
      }
    }

    return parsed as T;
  }

  private validateType(value: unknown, type: SchemaField['type']): boolean {
    if (value === null || value === undefined) return false;
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && !Array.isArray(value);
    }
  }
}

export class ParseError extends Error {
  constructor(message: string, public readonly rawOutput: string) {
    super(message);
    this.name = 'ParseError';
  }
}
