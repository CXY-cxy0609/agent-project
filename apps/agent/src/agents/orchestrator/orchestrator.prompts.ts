import { loadPrompt, loadSchema } from '../../harness/prompt/loader.js';
import { GLOBAL_RULES, buildRulesSection } from '../../constants/rules.js';

export const ORCHESTRATOR_PERSONA = loadPrompt('orchestrator/persona.md', {
  rules: buildRulesSection(GLOBAL_RULES),
});

export const ORCHESTRATOR_TASK = loadPrompt('orchestrator/task.md');
export const ORCHESTRATOR_IMAGE_SEMANTIC_TASK = loadPrompt('orchestrator/image-semantic.task.md');

export const INTENT_OUTPUT_SCHEMA = loadSchema('orchestrator/intent-output.schema.md');
export const IMAGE_SEMANTIC_OUTPUT_SCHEMA = loadSchema('orchestrator/image-semantic-output.schema.md');
