import type { ManimErrorType } from './error-classifier.js';

export type FixStrategy = 'rule' | 'local_patch' | 'full_rewrite';

export function chooseFixStrategy(
  errorType: ManimErrorType,
  retryCount: number,
): FixStrategy {
  if (retryCount >= 2) return 'full_rewrite';
  if (errorType === 'import' || errorType === 'name') return 'rule';
  if (errorType === 'syntax' || errorType === 'attribute' || errorType === 'runtime') {
    return 'local_patch';
  }
  return 'full_rewrite';
}

export interface RulePatchResult {
  applied: boolean;
  script: string;
  reason: string;
}

export function applyRulePatch(
  script: string,
  errorType: ManimErrorType,
  rawError: string,
): RulePatchResult {
  if (errorType === 'import' && script.includes('from manimlib import *')) {
    return {
      applied: true,
      script: script.replace('from manimlib import *', 'from manim import *'),
      reason: '将 manimlib 导入修正为 manim',
    };
  }

  if (errorType === 'name' && /name ['"]np['"] is not defined/i.test(rawError)) {
    if (!/import\s+numpy\s+as\s+np/m.test(script)) {
      return {
        applied: true,
        script: `import numpy as np\n${script}`,
        reason: '补充 numpy 别名导入',
      };
    }
  }

  return { applied: false, script, reason: '无可用规则补丁' };
}
