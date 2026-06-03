import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import type { AgentEventEnvelope } from '../harness/runtime/types.js';

export interface QaCompletedPayload {
  user_id: string;
  session_id: string;
  question: string;
  answer: string;
  subject: string;
  subject_id?: string;
  knowledge_points: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const EVENTS = {
  QA_COMPLETED: 'qa.completed',
} as const;

export type QaCompletedEvent = AgentEventEnvelope<QaCompletedPayload>;

class AgentEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  onQaCompleted(handler: (event: QaCompletedEvent) => void): void {
    this.on(EVENTS.QA_COMPLETED, handler);
  }

  emitQaCompleted(input: {
    workflowId: string;
    subgraphId: string;
    nodeId?: string;
    traceId: string;
    payload: QaCompletedPayload;
  }): void {
    const event: QaCompletedEvent = {
      event_id: randomUUID(),
      workflow_id: input.workflowId,
      subgraph_id: input.subgraphId,
      node_id: input.nodeId ?? 'finalize',
      event_type: EVENTS.QA_COMPLETED,
      payload: input.payload,
      timestamp: new Date().toISOString(),
      trace_id: input.traceId,
    };
    this.emit(EVENTS.QA_COMPLETED, event);
  }
}

export const eventBus = new AgentEventBus();
