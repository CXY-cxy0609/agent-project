import { loadPrompt, loadSchema } from '../../harness/prompt/loader.js';
import { LEARNING_RECORD_RULES, buildRulesSection } from '../../constants/rules.js';

export const LEARNING_RECORD_PERSONA = loadPrompt('learning-record/persona.md', {
  rules: buildRulesSection(LEARNING_RECORD_RULES),
});

export const EXTRACT_KNOWLEDGE_TASK = loadPrompt('learning-record/extract-knowledge.task.md');

export const GENERATE_REPORT_TASK = loadPrompt('learning-record/generate-report.task.md');

export const KNOWLEDGE_POINT_SCHEMA = loadSchema('learning-record/knowledge-point.schema.md');
