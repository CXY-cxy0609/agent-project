import type { NodeGovernancePolicy } from '../core/graph.js';

export interface GraphGovernanceConfig {
  qa: Record<string, NodeGovernancePolicy>;
  video: Record<string, NodeGovernancePolicy>;
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function nodePolicyFromEnv(prefix: string, defaults: NodeGovernancePolicy): NodeGovernancePolicy {
  return {
    timeoutMs: toPositiveInt(process.env[`${prefix}_TIMEOUT_MS`], defaults.timeoutMs),
    retry: {
      maxAttempts: toPositiveInt(process.env[`${prefix}_RETRY_MAX_ATTEMPTS`], defaults.retry.maxAttempts),
      backoffMs: toPositiveInt(process.env[`${prefix}_RETRY_BACKOFF_MS`], defaults.retry.backoffMs),
      backoffFactor: Number(process.env[`${prefix}_RETRY_BACKOFF_FACTOR`] ?? defaults.retry.backoffFactor ?? 2),
    },
  };
}

const DEFAULTS: GraphGovernanceConfig = {
  qa: {
    ocr: { timeoutMs: 8000, retry: { maxAttempts: 2, backoffMs: 200, backoffFactor: 2 } },
    rag: { timeoutMs: 10000, retry: { maxAttempts: 2, backoffMs: 300, backoffFactor: 2 } },
    generate: { timeoutMs: 15000, retry: { maxAttempts: 2, backoffMs: 500, backoffFactor: 2 } },
  },
  video: {
    checkCache: { timeoutMs: 4000, retry: { maxAttempts: 1, backoffMs: 0, backoffFactor: 2 } },
    generateStoryboard: { timeoutMs: 18000, retry: { maxAttempts: 2, backoffMs: 400, backoffFactor: 2 } },
    generateScript: { timeoutMs: 30000, retry: { maxAttempts: 2, backoffMs: 800, backoffFactor: 2 } },
    renderManim: { timeoutMs: 60000, retry: { maxAttempts: 1, backoffMs: 0, backoffFactor: 2 } },
    fixScript: { timeoutMs: 25000, retry: { maxAttempts: 2, backoffMs: 800, backoffFactor: 2 } },
    uploadVideo: { timeoutMs: 15000, retry: { maxAttempts: 2, backoffMs: 400, backoffFactor: 2 } },
    returnCached: { timeoutMs: 2000, retry: { maxAttempts: 1, backoffMs: 0, backoffFactor: 2 } },
  },
};

export function loadGraphGovernanceConfigFromEnv(): GraphGovernanceConfig {
  return {
    qa: {
      ocr: nodePolicyFromEnv('QA_NODE_OCR', DEFAULTS.qa.ocr),
      rag: nodePolicyFromEnv('QA_NODE_RAG', DEFAULTS.qa.rag),
      generate: nodePolicyFromEnv('QA_NODE_GENERATE', DEFAULTS.qa.generate),
    },
    video: {
      checkCache: nodePolicyFromEnv('VIDEO_NODE_CHECK_CACHE', DEFAULTS.video.checkCache),
      generateStoryboard: nodePolicyFromEnv('VIDEO_NODE_GENERATE_STORYBOARD', DEFAULTS.video.generateStoryboard),
      generateScript: nodePolicyFromEnv('VIDEO_NODE_GENERATE_SCRIPT', DEFAULTS.video.generateScript),
      renderManim: nodePolicyFromEnv('VIDEO_NODE_RENDER_MANIM', DEFAULTS.video.renderManim),
      fixScript: nodePolicyFromEnv('VIDEO_NODE_FIX_SCRIPT', DEFAULTS.video.fixScript),
      uploadVideo: nodePolicyFromEnv('VIDEO_NODE_UPLOAD_VIDEO', DEFAULTS.video.uploadVideo),
      returnCached: nodePolicyFromEnv('VIDEO_NODE_RETURN_CACHED', DEFAULTS.video.returnCached),
    },
  };
}
