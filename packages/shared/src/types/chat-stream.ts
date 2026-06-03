import type { Conversation, Message, MessageMetadata } from './chat';

export type ChatStreamEvent =
  | ChatStreamStartEvent
  | ChatStreamIntentEvent
  | ChatStreamConversationMetaEvent
  | ChatStreamMessageCreatedEvent
  | ChatStreamDeltaEvent
  | ChatStreamMessageFinalizedEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent
  | ChatStreamHeartbeatEvent;

export interface ChatStreamStartEvent {
  type: 'start';
  streamId: string;
  traceId?: string;
  sequence: number;
  conversationId?: string;
}

export interface ChatStreamIntentEvent {
  type: 'intent';
  streamId: string;
  sequence: number;
  intent: string;
  reasoning?: string;
  semanticSummary?: string;
  title?: string;
  assistantMessageId?: string;
}

export interface ChatStreamConversationMetaEvent {
  type: 'conversation.meta';
  streamId: string;
  sequence: number;
  conversation: Conversation;
}

export interface ChatStreamMessageCreatedEvent {
  type: 'message.created';
  streamId: string;
  sequence: number;
  userMessage: Message;
  assistantMessage: Message;
}

export interface ChatStreamDeltaEvent {
  type: 'delta';
  streamId: string;
  sequence: number;
  assistantMessageId: string;
  delta: string;
}

export interface ChatStreamMessageFinalizedEvent {
  type: 'message.finalized';
  streamId: string;
  sequence: number;
  assistantMessage: Message;
  metadata?: MessageMetadata;
}

export interface ChatStreamDoneEvent {
  type: 'done';
  streamId: string;
  sequence: number;
  conversationId: string;
}

export interface ChatStreamErrorEvent {
  type: 'error';
  streamId?: string;
  sequence?: number;
  code?: string;
  message: string;
  retryable?: boolean;
}

export interface ChatStreamHeartbeatEvent {
  type: 'heartbeat';
  streamId: string;
  sequence: number;
  timestamp: string;
}
