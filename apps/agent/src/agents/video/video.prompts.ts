import { loadPrompt, loadSchema } from '../../harness/prompt/loader.js';
import { VIDEO_AGENT_RULES, buildRulesSection } from '../../constants/rules.js';

export const VIDEO_PERSONA = loadPrompt('video/persona.md', {
  rules: buildRulesSection(VIDEO_AGENT_RULES),
});

export const STORYBOARD_TASK = loadPrompt('video/storyboard.task.md');

export const MANIM_SCRIPT_TASK = loadPrompt('video/manim-script.task.md');

export const MANIM_FIX_TASK = loadPrompt('video/manim-fix.task.md');

export const STORYBOARD_OUTPUT_SCHEMA = loadSchema('video/storyboard-output.schema.md');

export const MANIM_SCRIPT_OUTPUT_SCHEMA = loadSchema('video/manim-script-output.schema.md');
