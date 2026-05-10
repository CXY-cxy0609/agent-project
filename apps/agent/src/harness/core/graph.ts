/**
 * StateGraph — 轻量状态机
 * 保留 LangGraph 的图拓扑思路，但用显式接口替代 Annotation/Reducer 魔法
 * 合并规则完全透明：节点返回 Partial<S>，框架做 Object.assign 浅合并
 */

import type { GraphStreamEvent } from './types.js';
import { GRAPH_END, type GraphCheckpoint, type GraphCheckpointStore } from './checkpoint.js';

export const END = '__end__' as const;
export type END = typeof END;

export type NodeFn<S> = (state: Readonly<S>) => Promise<Partial<S>>;
export type ConditionFn<S, Routes extends string> = (state: Readonly<S>) => Routes;

interface EdgeDef {
  from: string;
  to: string | END;
}

interface ConditionalEdgeDef<S> {
  from: string;
  condition: ConditionFn<S, string>;
  routeMap: Record<string, string | END>;
}

export class StateGraph<S extends object> {
  private nodes = new Map<string, NodeFn<S>>();
  private edges: EdgeDef[] = [];
  private conditionalEdges: ConditionalEdgeDef<S>[] = [];

  constructor(private readonly initialState: S) {}

  addNode(name: string, fn: NodeFn<S>): this {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string | END): this {
    this.edges.push({ from, to });
    return this;
  }

  addConditionalEdge<Routes extends string>(
    from: string,
    condition: ConditionFn<S, Routes>,
    routeMap: Record<Routes, string | END>,
  ): this {
    this.conditionalEdges.push({
      from,
      condition: condition as ConditionFn<S, string>,
      routeMap: routeMap as Record<string, string | END>,
    });
    return this;
  }

  compile(): GraphRunner<S> {
    return new GraphRunner<S>(
      this.initialState,
      this.nodes,
      this.edges,
      this.conditionalEdges,
    );
  }
}

export class GraphRunner<S extends object> {
  constructor(
    private readonly initialState: S,
    private readonly nodes: Map<string, NodeFn<S>>,
    private readonly edges: EdgeDef[],
    private readonly conditionalEdges: ConditionalEdgeDef<S>[],
  ) {}

  async run(
    input: Partial<S>,
    options?: GraphRunOptions<S>,
  ): Promise<S> {
    return this.execute(input, options);
  }

  /** 非流式：执行完毕后返回最终状态 */

  /** 流式：逐节点/逐 token 推送事件 */
  async *runStream(input: Partial<S>): AsyncGenerator<GraphStreamEvent<S>> {
    let state: S = { ...this.initialState, ...input };
    let current = this.findEntryNode();

    while (current !== END) {
      const fn = this.nodes.get(current);
      if (!fn) throw new Error(`Node "${current}" not found in graph`);

      yield { type: 'node_start', node: current };

      const delta = await fn(state as Readonly<S>);
      state = { ...state, ...delta };

      yield { type: 'node_done', node: current, delta };

      current = this.resolveNext(current, state);
    }

    yield { type: 'graph_done', finalState: state };
  }

  private findEntryNode(): string {
    const allTargets = new Set([
      ...this.edges.filter((e) => e.to !== END).map((e) => e.to as string),
      ...this.conditionalEdges.flatMap((e) =>
        Object.values(e.routeMap).filter((v) => v !== END) as string[],
      ),
    ]);

    for (const name of this.nodes.keys()) {
      if (!allTargets.has(name)) return name;
    }

    const [first] = this.nodes.keys();
    return first;
  }

  private resolveNext(current: string, state: S): string | END {
    const directEdge = this.edges.find((e) => e.from === current);
    if (directEdge) return directEdge.to;

    const condEdge = this.conditionalEdges.find((e) => e.from === current);
    if (condEdge) {
      const route = condEdge.condition(state as Readonly<S>);
      const next = condEdge.routeMap[route];
      if (next === undefined) throw new Error(`Unhandled route "${route}" from node "${current}"`);
      return next;
    }

    return END;
  }

  private async execute(
    input: Partial<S>,
    options?: GraphRunOptions<S>,
  ): Promise<S> {
    const checkpointStore = options?.checkpointStore;
    const workflowId = options?.workflowId;
    const useCheckpoint = Boolean(checkpointStore && workflowId);
    const clearOnDone = options?.clearCheckpointOnDone ?? false;

    let state: S = { ...this.initialState, ...input };
    let current = this.findEntryNode();

    if (useCheckpoint && options?.resumeFromCheckpoint) {
      const checkpoint = await checkpointStore!.load(workflowId!);
      if (checkpoint) {
        state = { ...checkpoint.state, ...input };
        current = checkpoint.nextNode === GRAPH_END ? END : checkpoint.nextNode;

        if (checkpoint.status === 'completed') {
          return state;
        }
      }
    }

    try {
      while (current !== END) {
        if (useCheckpoint) {
          await this.persistCheckpoint(checkpointStore!, {
            workflowId: workflowId!,
            status: 'running',
            nextNode: current,
            state,
            updatedAt: new Date().toISOString(),
          }, options?.onCheckpoint);
        }

        const fn = this.nodes.get(current);
        if (!fn) throw new Error(`Node "${current}" not found in graph`);

        const delta = await fn(state as Readonly<S>);
        state = { ...state, ...delta };

        current = this.resolveNext(current, state);

        if (useCheckpoint) {
          await this.persistCheckpoint(checkpointStore!, {
            workflowId: workflowId!,
            status: 'running',
            nextNode: current,
            state,
            updatedAt: new Date().toISOString(),
          }, options?.onCheckpoint);
        }
      }

      if (useCheckpoint) {
        await this.persistCheckpoint(checkpointStore!, {
          workflowId: workflowId!,
          status: 'completed',
          nextNode: GRAPH_END,
          state,
          updatedAt: new Date().toISOString(),
        }, options?.onCheckpoint);

        if (clearOnDone && checkpointStore!.clear) {
          await checkpointStore!.clear(workflowId!);
        }
      }

      return state;
    } catch (err) {
      if (useCheckpoint) {
        const message = err instanceof Error ? err.message : String(err);
        await this.persistCheckpoint(checkpointStore!, {
          workflowId: workflowId!,
          status: 'failed',
          nextNode: current === END ? GRAPH_END : current,
          state,
          updatedAt: new Date().toISOString(),
          error: message,
        }, options?.onCheckpoint);
      }
      throw err;
    }
  }

  private async persistCheckpoint(
    checkpointStore: GraphCheckpointStore<S>,
    checkpoint: GraphCheckpoint<S>,
    onCheckpoint?: (checkpoint: GraphCheckpoint<S>) => Promise<void> | void,
  ): Promise<void> {
    await checkpointStore.save(checkpoint);
    await onCheckpoint?.(checkpoint);
  }
}

export interface GraphRunOptions<S extends object> {
  workflowId?: string;
  checkpointStore?: GraphCheckpointStore<S>;
  /** 为 true 时尝试加载已有 checkpoint 并续跑 */
  resumeFromCheckpoint?: boolean;
  /** 完成后自动清理 checkpoint */
  clearCheckpointOnDone?: boolean;
  onCheckpoint?: (checkpoint: GraphCheckpoint<S>) => Promise<void> | void;
}
