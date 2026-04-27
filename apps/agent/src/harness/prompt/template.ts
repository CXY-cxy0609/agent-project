/**
 * Prompt 模板引擎 — 轻量 Mustache 风格，无外部依赖
 */

export interface PromptTemplate {
  name: string;
  template: string;
  requiredVars: string[];
  optionalVars?: Record<string, string>;
}

export class PromptRenderer {
  render(template: PromptTemplate, vars: Record<string, string>): string {
    const allVars = { ...template.optionalVars, ...vars };

    // 验证必填变量
    for (const required of template.requiredVars) {
      if (!(required in allVars)) {
        throw new Error(
          `Missing required variable "${required}" in template "${template.name}"`,
        );
      }
    }

    return template.template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return key in allVars ? allVars[key] : match;
    });
  }
}

export const renderer = new PromptRenderer();
