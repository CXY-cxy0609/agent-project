/**
 * 事件总线 — 用于 Agent 间的异步通信（fire-and-forget）
 * 例：QA Agent 完成后异步通知 Learning Record Agent
 */

import { EventEmitter } from 'events';

export interface QaCompletedEvent {
  traceId: string;
  userId: string;
  sessionId: string;
  question: string;
  answer: string;
  subject: string;
  knowledgePoints: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const EVENTS = {
  QA_COMPLETED: 'qa.completed',
} as const;

class AgentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  onQaCompleted(handler: (event: QaCompletedEvent) => void): void {
    this.on(EVENTS.QA_COMPLETED, handler);
  }

  emitQaCompleted(event: QaCompletedEvent): void {
    this.emit(EVENTS.QA_COMPLETED, event);
  }
}

export const eventBus = new AgentEventBus();
