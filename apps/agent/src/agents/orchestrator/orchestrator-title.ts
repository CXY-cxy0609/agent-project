import type { OrchestratorInput } from './orchestrator.types.js';

const MAX_CONVERSATION_TITLE_LENGTH = 24;
const TITLE_PREFIX_PATTERN = /^(请|帮我|帮忙|麻烦)?\s*(简单)?(介绍|讲解|解释|说明|分析|说说|聊聊)(一下|下)?/;

export function shouldGenerateConversationTitle(input: OrchestratorInput, historyLength: number): boolean {
  if (typeof input.messageCount === 'number' && Number.isFinite(input.messageCount)) {
    return input.messageCount <= 0;
  }
  return historyLength === 0;
}

export function normalizeConversationTitle(title?: string): string | undefined {
  const normalized = title
    ?.replace(/\s+/g, ' ')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(TITLE_PREFIX_PATTERN, '')
    .trim();
  if (!normalized) return undefined;
  return Array.from(normalized).slice(0, MAX_CONVERSATION_TITLE_LENGTH).join('');
}

export function buildHeuristicConversationTitle(message: string): string | undefined {
  return normalizeConversationTitle(
    message
      .replace(/(生成|制作|创建|做一个|来一个)?(讲解)?(视频|动画|演示)/g, '')
      .replace(/这个问题|这道题/g, '')
      .trim(),
  );
}
