import type { AgentContext } from '../../harness/core/types.js';
import type { IntentClassification } from './orchestrator.types.js';

type IntentReasoningEmitter = (event: {
  intent: string;
  reasoning?: string;
  semanticSummary?: string;
  title?: string;
}) => void;

export function emitIntentReasoning(
  ctx: AgentContext,
  intent: IntentClassification,
  semanticSummary?: string,
): void {
  const emitter = ctx.metadata?.reasoningEmitter;
  if (typeof emitter !== 'function') return;
  (emitter as IntentReasoningEmitter)({
    intent: intent.intent,
    reasoning: intent.reasoning,
    semanticSummary,
    title: intent.title,
  });
}
