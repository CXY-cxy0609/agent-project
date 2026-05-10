export type ManimErrorType =
  | 'syntax'
  | 'import'
  | 'name'
  | 'attribute'
  | 'latex'
  | 'timeout'
  | 'runtime'
  | 'unknown';

export interface ManimErrorClassification {
  type: ManimErrorType;
  confidence: number;
  summary: string;
}

export function classifyManimError(rawError: string): ManimErrorClassification {
  const error = rawError.toLowerCase();

  if (error.includes('syntaxerror') || error.includes('indentationerror')) {
    return { type: 'syntax', confidence: 0.95, summary: '脚本语法错误' };
  }
  if (error.includes('modulenotfounderror') || error.includes('importerror')) {
    return { type: 'import', confidence: 0.92, summary: '导入依赖错误' };
  }
  if (error.includes('nameerror')) {
    return { type: 'name', confidence: 0.9, summary: '变量或符号未定义' };
  }
  if (error.includes('attributeerror')) {
    return { type: 'attribute', confidence: 0.9, summary: '对象属性或方法访问错误' };
  }
  if (error.includes('latex') || error.includes('tex') || error.includes('xelatex')) {
    return { type: 'latex', confidence: 0.85, summary: 'LaTeX 渲染相关错误' };
  }
  if (error.includes('abort') || error.includes('timed out') || error.includes('timeout')) {
    return { type: 'timeout', confidence: 0.8, summary: '渲染超时或进程中断' };
  }
  if (error.includes('traceback')) {
    return { type: 'runtime', confidence: 0.7, summary: '运行时错误' };
  }
  return { type: 'unknown', confidence: 0.5, summary: '未知错误' };
}
