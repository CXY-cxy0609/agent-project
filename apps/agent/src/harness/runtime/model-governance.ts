import { MODELS } from '../../constants/models.js';

export interface ModelGovernanceConfig {
  orchestrator: {
    classifyIntent: string;
  };
  qa: {
    generate: string;
  };
  video: {
    generateStoryboard: string;
    generateScript: string;
    fixScript: string;
  };
  learningRecord: {
    extractKnowledge: string;
    generateReport: string;
  };
  tools: {
    imageOcr: string;
  };
}

function defaultModelsByProvider(provider: string | undefined): { fast: string; smart: string } {
  if (provider === 'doubao') {
    return {
      fast: MODELS.DOUBAO_LITE,
      smart: MODELS.DOUBAO_PRO,
    };
  }
  return {
    fast: MODELS.HAIKU,
    smart: MODELS.SONNET,
  };
}

function modelFromEnv(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export function loadModelGovernanceConfigFromEnv(): ModelGovernanceConfig {
  const defaults = defaultModelsByProvider(process.env.LLM_PROVIDER);
  return {
    orchestrator: {
      classifyIntent: modelFromEnv('MODEL_ORCHESTRATOR_CLASSIFY_INTENT', defaults.fast),
    },
    qa: {
      generate: modelFromEnv('MODEL_QA_GENERATE', defaults.smart),
    },
    video: {
      generateStoryboard: modelFromEnv('MODEL_VIDEO_GENERATE_STORYBOARD', defaults.smart),
      generateScript: modelFromEnv('MODEL_VIDEO_GENERATE_SCRIPT', defaults.smart),
      fixScript: modelFromEnv('MODEL_VIDEO_FIX_SCRIPT', defaults.smart),
    },
    learningRecord: {
      extractKnowledge: modelFromEnv('MODEL_LEARNING_RECORD_EXTRACT_KNOWLEDGE', defaults.fast),
      generateReport: modelFromEnv('MODEL_LEARNING_RECORD_GENERATE_REPORT', defaults.fast),
    },
    tools: {
      imageOcr: modelFromEnv('MODEL_TOOL_IMAGE_OCR', defaults.fast),
    },
  };
}
