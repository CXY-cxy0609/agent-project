import type { Message } from '@tutor/shared';

const ROLE_ORDER: Record<Message['role'], number> = {
  system: 0,
  user: 1,
  assistant: 2,
};

export function normalizeMessageOrder(list: Message[]): Message[] {
  const sorted = [...list].sort(compareMessages);
  return sorted;
}

function compareMessages(a: Message, b: Message): number {
  if (typeof a.seq === 'number' && typeof b.seq === 'number' && a.seq !== b.seq) {
    return a.seq - b.seq;
  }
  if (a.turnId && b.turnId && a.turnId === b.turnId) {
    return ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
  }
  if (b.replyToMessageId === a.id) return -1;
  if (a.replyToMessageId === b.id) return 1;
  const byCreatedAt = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (Number.isFinite(byCreatedAt) && byCreatedAt !== 0) return byCreatedAt;
  return a.id.localeCompare(b.id);
}
