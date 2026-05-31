import type { WorkflowStateSnapshot, WorkflowStateStore } from './types.js';

interface WorkflowStateEntry {
  workflow_state: Record<string, unknown>;
  node_state: Record<string, Record<string, unknown>>;
  artifact_state: Record<string, unknown>;
}

export class InMemoryWorkflowStateStore implements WorkflowStateStore {
  private readonly store = new Map<string, WorkflowStateEntry>();

  init(workflowId: string): void {
    if (this.store.has(workflowId)) return;
    this.store.set(workflowId, {
      workflow_state: {},
      node_state: {},
      artifact_state: {},
    });
  }

  updateWorkflowState(workflowId: string, patch: Record<string, unknown>): void {
    const entry = this.getEntry(workflowId);
    entry.workflow_state = { ...entry.workflow_state, ...patch };
  }

  setNodeState(workflowId: string, nodeId: string, state: Record<string, unknown>): void {
    const entry = this.getEntry(workflowId);
    entry.node_state[nodeId] = { ...state };
  }

  setArtifact(workflowId: string, key: string, value: unknown): void {
    const entry = this.getEntry(workflowId);
    entry.artifact_state[key] = value;
  }

  snapshot(workflowId: string): WorkflowStateSnapshot {
    const entry = this.getEntry(workflowId);
    return {
      workflow_state: { ...entry.workflow_state },
      node_state: Object.fromEntries(
        Object.entries(entry.node_state).map(([nodeId, state]) => [nodeId, { ...state }]),
      ),
      artifact_state: { ...entry.artifact_state },
    };
  }

  private getEntry(workflowId: string): WorkflowStateEntry {
    const entry = this.store.get(workflowId);
    if (entry) return entry;
    this.init(workflowId);
    return this.store.get(workflowId)!;
  }
}
