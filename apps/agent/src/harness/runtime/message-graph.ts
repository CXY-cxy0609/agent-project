import type { NodeGovernancePolicy } from '../core/graph.js';

export const MESSAGE_GRAPH_END = '__end__' as const;
export type MessageGraphEnd = typeof MESSAGE_GRAPH_END;

export interface MessageEnvelope<TPayload = unknown> {
  event_type: string;
  node_id: string;
  payload: TPayload;
  timestamp: string;
}

export interface MessageGraphPartitions {
  workflow_state: Record<string, unknown>;
  node_state: Record<string, Record<string, unknown>>;
  artifact_state: Record<string, unknown>;
}

export interface MessageGraphNodeContext {
  readonly nodeId: string;
  getWorkflowState: () => Readonly<Record<string, unknown>>;
  patchWorkflowState: (patch: Record<string, unknown>) => void;
  getNodeState: () => Readonly<Record<string, unknown>>;
  setNodeState: (patch: unknown) => void;
  getArtifact: (key: string) => unknown;
  setArtifact: (key: string, value: unknown) => void;
  emitEvent: <TPayload>(eventType: string, payload: TPayload) => void;
  readEvents: (eventType?: string) => MessageEnvelope[];
}

export type MessageGraphNodeFn = (ctx: MessageGraphNodeContext) => Promise<void>;
export type MessageGraphRouteFn = (
  partitions: Readonly<MessageGraphPartitions>,
  events: readonly MessageEnvelope[],
) => string;

interface EdgeDef {
  from: string;
  to: string | MessageGraphEnd;
}

interface ConditionalEdgeDef {
  from: string;
  route: MessageGraphRouteFn;
  routeMap: Record<string, string | MessageGraphEnd>;
}

export interface MessageGraphNodeEvent {
  node: string;
  event: 'started' | 'retry' | 'timed_out' | 'succeeded' | 'failed';
  attempt: number;
  elapsedMs?: number;
  error?: string;
}

export interface MessageGraphRunOptions {
  nodePolicies?: Record<string, NodeGovernancePolicy>;
  onNodeEvent?: (event: MessageGraphNodeEvent) => Promise<void> | void;
}

export class MessageDrivenGraph {
  private readonly nodes = new Map<string, MessageGraphNodeFn>();
  private readonly edges: EdgeDef[] = [];
  private readonly conditionalEdges: ConditionalEdgeDef[] = [];

  constructor(private readonly initialWorkflowState: Record<string, unknown>) {}

  addNode(name: string, fn: MessageGraphNodeFn): this {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string | MessageGraphEnd): this {
    this.edges.push({ from, to });
    return this;
  }

  addConditionalEdge(
    from: string,
    route: MessageGraphRouteFn,
    routeMap: Record<string, string | MessageGraphEnd>,
  ): this {
    this.conditionalEdges.push({ from, route, routeMap });
    return this;
  }

  async run(options?: MessageGraphRunOptions): Promise<{
    partitions: MessageGraphPartitions;
    events: MessageEnvelope[];
  }> {
    const partitions: MessageGraphPartitions = {
      workflow_state: { ...this.initialWorkflowState },
      node_state: {},
      artifact_state: {},
    };
    const events: MessageEnvelope[] = [];
    let current = this.findEntryNode();

    while (current !== MESSAGE_GRAPH_END) {
      const node = this.nodes.get(current);
      if (!node) throw new Error(`Node "${current}" not found in message graph`);
      const policy = options?.nodePolicies?.[current];
      await this.runNodeWithGovernance(current, node, partitions, events, policy, options?.onNodeEvent);
      current = this.resolveNext(current, partitions, events);
    }

    return { partitions, events };
  }

  private findEntryNode(): string {
    const allTargets = new Set([
      ...this.edges.filter((e) => e.to !== MESSAGE_GRAPH_END).map((e) => e.to as string),
      ...this.conditionalEdges.flatMap((e) =>
        Object.values(e.routeMap).filter((v) => v !== MESSAGE_GRAPH_END) as string[],
      ),
    ]);
    for (const name of this.nodes.keys()) {
      if (!allTargets.has(name)) return name;
    }
    const [first] = this.nodes.keys();
    return first;
  }

  private resolveNext(
    current: string,
    partitions: MessageGraphPartitions,
    events: MessageEnvelope[],
  ): string | MessageGraphEnd {
    const direct = this.edges.find((edge) => edge.from === current);
    if (direct) return direct.to;

    const conditional = this.conditionalEdges.find((edge) => edge.from === current);
    if (!conditional) return MESSAGE_GRAPH_END;
    const route = conditional.route(partitions, events);
    const next = conditional.routeMap[route];
    if (next === undefined) {
      throw new Error(`Unhandled route "${route}" from node "${current}"`);
    }
    return next;
  }

  private async runNodeWithGovernance(
    nodeId: string,
    node: MessageGraphNodeFn,
    partitions: MessageGraphPartitions,
    events: MessageEnvelope[],
    policy: NodeGovernancePolicy | undefined,
    onNodeEvent?: (event: MessageGraphNodeEvent) => Promise<void> | void,
  ): Promise<void> {
    const retry = {
      maxAttempts: Math.max(1, policy?.retry.maxAttempts ?? 1),
      backoffMs: Math.max(0, policy?.retry.backoffMs ?? 0),
      backoffFactor: policy?.retry.backoffFactor && policy.retry.backoffFactor > 0
        ? policy.retry.backoffFactor
        : 2,
    };
    const timeoutMs = policy?.timeoutMs ?? 0;

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
      const startedAt = Date.now();
      await onNodeEvent?.({ node: nodeId, event: 'started', attempt });
      try {
        await this.runWithTimeout(
          node(this.createNodeContext(nodeId, partitions, events)),
          timeoutMs,
          nodeId,
        );
        await onNodeEvent?.({
          node: nodeId,
          event: 'succeeded',
          attempt,
          elapsedMs: Date.now() - startedAt,
        });
        return;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        const timedOut = err.message.startsWith('NodeTimeout:');
        await onNodeEvent?.({
          node: nodeId,
          event: timedOut ? 'timed_out' : 'failed',
          attempt,
          elapsedMs: Date.now() - startedAt,
          error: err.message,
        });
        if (attempt >= retry.maxAttempts) break;
        const delay = Math.round(retry.backoffMs * retry.backoffFactor ** (attempt - 1));
        await onNodeEvent?.({
          node: nodeId,
          event: 'retry',
          attempt,
          elapsedMs: delay,
          error: err.message,
        });
        await sleep(delay);
      }
    }
    throw lastError ?? new Error(`Node "${nodeId}" failed`);
  }

  private createNodeContext(
    nodeId: string,
    partitions: MessageGraphPartitions,
    events: MessageEnvelope[],
  ): MessageGraphNodeContext {
    return {
      nodeId,
      getWorkflowState: () => ({ ...partitions.workflow_state }),
      patchWorkflowState: (patch) => {
        partitions.workflow_state = { ...partitions.workflow_state, ...patch };
      },
      getNodeState: () => ({ ...(partitions.node_state[nodeId] ?? {}) }),
      setNodeState: (patch) => {
        const normalized = toRecord(patch);
        partitions.node_state[nodeId] = {
          ...(partitions.node_state[nodeId] ?? {}),
          ...normalized,
        };
      },
      getArtifact: (key) => partitions.artifact_state[key],
      setArtifact: (key, value) => {
        partitions.artifact_state[key] = value;
      },
      emitEvent: (eventType, payload) => {
        events.push({
          event_type: eventType,
          node_id: nodeId,
          payload,
          timestamp: new Date().toISOString(),
        });
      },
      readEvents: (eventType) => {
        if (!eventType) return events.map((event) => ({ ...event }));
        return events.filter((event) => event.event_type === eventType).map((event) => ({ ...event }));
      },
    };
  }

  private async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, nodeId: string): Promise<T> {
    if (timeoutMs <= 0) return promise;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`NodeTimeout:${nodeId}:${timeoutMs}ms`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}
