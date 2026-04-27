import type { PromptTemplate } from '../../harness/prompt/template.js';
import type { OutputSchema } from '../../harness/output/schema-parser.js';
import { VIDEO_AGENT_RULES, buildRulesSection } from '../../constants/rules.js';

export const VIDEO_PERSONA: PromptTemplate = {
  name: 'video-persona',
  template: `你是一位擅长制作数学教学动画的内容创作专家，精通 Manim 数学动画库。
你能够将复杂的数学概念拆解成清晰的动画场景，让学生直观理解。

${buildRulesSection(VIDEO_AGENT_RULES)}`,
  requiredVars: [],
};

export const STORYBOARD_TASK: PromptTemplate = {
  name: 'storyboard-task',
  template: `请为以下知识点创作讲解视频的分镜脚本：

知识点：{{knowledge}}
科目：{{subject}}

要求每个场景包含：描述、动画说明、旁白文案、预计时长（秒）
控制在 3-6 个场景，总时长不超过 3 分钟。`,
  requiredVars: ['knowledge', 'subject'],
};

export const MANIM_SCRIPT_TASK: PromptTemplate = {
  name: 'manim-script-task',
  template: `根据以下分镜脚本，生成完整可运行的 Manim Python 代码：

分镜脚本：
{{storyboard}}

要求：
1. 使用 Manim Community Edition (manim v0.18+) 语法
2. 所有场景封装在一个 Scene 类中
3. 代码完整，可直接运行
4. 包含必要的 import 语句`,
  requiredVars: ['storyboard'],
};

export const MANIM_FIX_TASK: PromptTemplate = {
  name: 'manim-fix-task',
  template: `以下 Manim 脚本在执行时报错，请分析错误原因并修复：

原始脚本：
\`\`\`python
{{script}}
\`\`\`

错误信息：
\`\`\`
{{error}}
\`\`\`

请输出修复后的完整脚本。`,
  requiredVars: ['script', 'error'],
};

export const STORYBOARD_OUTPUT_SCHEMA: OutputSchema = {
  fields: [
    {
      name: 'scenes',
      type: 'array',
      required: true,
      description: '场景列表，每个场景包含 scene_index、description、animation_notes、narration、duration_seconds',
    },
    {
      name: 'total_duration_seconds',
      type: 'number',
      required: true,
      description: '视频总时长（秒）',
    },
  ],
};

export const MANIM_SCRIPT_OUTPUT_SCHEMA: OutputSchema = {
  fields: [
    {
      name: 'script',
      type: 'string',
      required: true,
      description: '完整的 Manim Python 脚本',
    },
    {
      name: 'scene_class_name',
      type: 'string',
      required: true,
      description: 'Manim Scene 类名',
    },
  ],
};
