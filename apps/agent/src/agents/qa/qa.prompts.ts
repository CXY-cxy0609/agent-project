import { loadPrompt, loadSchema } from '../../harness/prompt/loader.js';
import { GLOBAL_RULES, QA_AGENT_RULES, buildRulesSection } from '../../constants/rules.js';

export const QA_PERSONA = loadPrompt('qa/persona.md', {
  rules: buildRulesSection([...GLOBAL_RULES, ...QA_AGENT_RULES]),
});

export const QA_TASK = loadPrompt('qa/task.md');

export const QA_OUTPUT_SCHEMA = loadSchema('qa/qa-output.schema.md');
