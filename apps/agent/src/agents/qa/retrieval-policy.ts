import type { RetrievalMode } from '../../harness/rag-client/rag-client.js';

export interface QARetrievalPolicyConfig {
  hybridHintKeywords: string[];
  minOcrLengthForTextOnly: number;
  hybridBudgetTokens: number;
  hybridMaxUpgradePages: number;
}

export interface RetrievalPolicyDecision {
  mode: RetrievalMode;
  budgetTokens?: number;
  maxUpgradePages?: number;
}

export const DEFAULT_QA_RETRIEVAL_POLICY: QARetrievalPolicyConfig = {
  hybridHintKeywords: ['图', '函数图像', '几何', '流程图', '表格', '矩阵', '证明', '坐标系'],
  minOcrLengthForTextOnly: 120,
  hybridBudgetTokens: 3000,
  hybridMaxUpgradePages: 3,
};

export function decideRetrievalPolicy(
  question: string,
  ocrText: string,
  config: QARetrievalPolicyConfig,
): RetrievalPolicyDecision {
  const combined = `${question}\n${ocrText}`.toLowerCase();
  const hasVisualHints = config.hybridHintKeywords.some((hint) => combined.includes(hint));
  const shortOcr = ocrText.trim().length < config.minOcrLengthForTextOnly;

  if (hasVisualHints || shortOcr) {
    return {
      mode: 'hybrid_visual',
      budgetTokens: config.hybridBudgetTokens,
      maxUpgradePages: config.hybridMaxUpgradePages,
    };
  }

  return { mode: 'text_only' };
}
