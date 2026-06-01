import { loadPrompt, loadSchema } from '../../harness/prompt/loader.js';
import { VIDEO_AGENT_RULES, buildRulesSection } from '../../constants/rules.js';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const PROMPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../prompt');

function loadVideoPromptDoc(relativePath: string): string {
  return readFileSync(resolve(PROMPT_DIR, relativePath), 'utf-8').trim();
}

const BASE_SCENE_USAGE_RULES = loadVideoPromptDoc('video/base-scene-usage.md');

export const VIDEO_PERSONA = loadPrompt('video/persona.md', {
  rules: buildRulesSection(VIDEO_AGENT_RULES),
});

export const STORYBOARD_TASK = loadPrompt('video/storyboard.task.md');

export const MANIM_SCRIPT_TASK = loadPrompt('video/manim-script.task.md', {
  baseSceneUsageRules: BASE_SCENE_USAGE_RULES,
});

export const MANIM_FIX_TASK = loadPrompt('video/manim-fix.task.md', {
  baseSceneUsageRules: BASE_SCENE_USAGE_RULES,
});

export const STORYBOARD_OUTPUT_SCHEMA = loadSchema('video/storyboard-output.schema.md');
