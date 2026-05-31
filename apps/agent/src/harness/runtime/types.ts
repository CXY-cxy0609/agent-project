import type { AgentContext } from '../core/types.js';

export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentEventEnvelope<TPayload = unknown> {
  event_id: string;
  workflow_id: string;
  subgraph_id: string;
  node_id: string;
  event_type: string;
  payload: TPayload;
  timestamp: string;
  trace_id: string;
}

export interface WorkflowStateSnapshot {
  workflow_state: Record<string, unknown>;
  node_state: Record<string, Record<string, unknown>>;
  artifact_state: Record<string, unknown>;
}

export interface WorkflowStateStore {
  init(workflowId: string): void;
  updateWorkflowState(workflowId: string, patch: Record<string, unknown>): void;
  setNodeState(workflowId: string, nodeId: string, state: Record<string, unknown>): void;
  setArtifact(workflowId: string, key: string, value: unknown): void;
  snapshot(workflowId: string): WorkflowStateSnapshot;
}

export interface SubgraphExecutionContext {
  workflowId: string;
  subgraphId: string;
  agentContext: AgentContext;
  stateStore: WorkflowStateStore;
  emitEvent: <TPayload>(eventType: string, nodeId: string, payload: TPayload) => void;
}

export interface SubgraphDefinition<TInput, TOutput> {
  id: string;
  run: (input: TInput, context: SubgraphExecutionContext) => Promise<TOutput>;
}
