import { randomUUID } from 'node:crypto';
import type { EventEmitter } from 'node:events';
import type {
  AgentEventEnvelope,
  SubgraphDefinition,
  SubgraphExecutionContext,
  WorkflowStateStore,
  WorkflowStatus,
} from './types.js';
import type { AgentContext } from '../core/types.js';

interface ExecuteSubgraphOptions {
  workflowId?: string;
}

export class WorkflowScheduler {
  private readonly subgraphs = new Map<string, SubgraphDefinition<unknown, unknown>>();

  constructor(
    private readonly stateStore: WorkflowStateStore,
    private readonly eventEmitter?: EventEmitter,
  ) {}

  register<TInput, TOutput>(subgraph: SubgraphDefinition<TInput, TOutput>): void {
    this.subgraphs.set(subgraph.id, subgraph as SubgraphDefinition<unknown, unknown>);
  }

  async executeSubgraph<TInput, TOutput>(
    subgraphId: string,
    input: TInput,
    ctx: AgentContext,
    options?: ExecuteSubgraphOptions,
  ): Promise<TOutput> {
    const workflowId = options?.workflowId ?? this.resolveWorkflowId(ctx);
    const subgraph = this.subgraphs.get(subgraphId);
    if (!subgraph) {
      throw new Error(`subgraph "${subgraphId}" is not registered`);
    }

    this.stateStore.init(workflowId);
    this.updateWorkflowStatus(workflowId, subgraphId, 'running');
    this.emit(workflowId, subgraphId, 'scheduler', 'subgraph.started', {
      input,
    }, ctx.traceId);

    const executionContext: SubgraphExecutionContext = {
      workflowId,
      subgraphId,
      agentContext: {
        ...ctx,
        metadata: {
          ...(ctx.metadata ?? {}),
          workflowId,
          subgraphId,
        },
      },
      stateStore: this.stateStore,
      emitEvent: <TPayload>(eventType: string, nodeId: string, payload: TPayload) => {
        this.emit(workflowId, subgraphId, nodeId, eventType, payload, ctx.traceId);
      },
    };

    try {
      const output = await subgraph.run(input, executionContext) as TOutput;
      this.stateStore.setNodeState(workflowId, `${subgraphId}.result`, {
        status: 'completed',
      });
      this.updateWorkflowStatus(workflowId, subgraphId, 'completed');
      this.emit(workflowId, subgraphId, 'scheduler', 'subgraph.completed', {
        output,
      }, ctx.traceId);
      return output;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.stateStore.setNodeState(workflowId, `${subgraphId}.result`, {
        status: 'failed',
        error: err.message,
      });
      this.updateWorkflowStatus(workflowId, subgraphId, 'failed');
      this.emit(workflowId, subgraphId, 'scheduler', 'subgraph.failed', {
        error: err.message,
      }, ctx.traceId);
      throw err;
    }
  }

  private resolveWorkflowId(ctx: AgentContext): string {
    const workflowId = ctx.metadata?.workflowId;
    if (typeof workflowId === 'string' && workflowId.trim().length > 0) {
      return workflowId;
    }
    return `${ctx.sessionId}:${ctx.traceId}`;
  }

  private updateWorkflowStatus(
    workflowId: string,
    subgraphId: string,
    status: WorkflowStatus,
  ): void {
    this.stateStore.updateWorkflowState(workflowId, {
      last_subgraph_id: subgraphId,
      status,
      updated_at: new Date().toISOString(),
    });
  }

  private emit<TPayload>(
    workflowId: string,
    subgraphId: string,
    nodeId: string,
    eventType: string,
    payload: TPayload,
    traceId: string,
  ): void {
    if (!this.eventEmitter) return;
    const envelope: AgentEventEnvelope<TPayload> = {
      event_id: randomUUID(),
      workflow_id: workflowId,
      subgraph_id: subgraphId,
      node_id: nodeId,
      event_type: eventType,
      payload,
      timestamp: new Date().toISOString(),
      trace_id: traceId,
    };
    this.eventEmitter.emit(eventType, envelope);
  }
}
