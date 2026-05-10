/**
 * Graph Checkpoint Types
 * 用于工作流断点续跑的持久化抽象
 */
export const GRAPH_END = '__end__' as const;
export type GraphEnd = typeof GRAPH_END;

export type GraphCheckpointStatus = 'running' | 'completed' | 'failed';

export interface GraphCheckpoint<S extends object> {
  workflowId: string;
  status: GraphCheckpointStatus;
  /** 下一步待执行节点；END 表示已结束 */
  nextNode: string | GraphEnd;
  state: S;
  updatedAt: string;
  error?: string;
}

export interface GraphCheckpointStore<S extends object> {
  load(workflowId: string): Promise<GraphCheckpoint<S> | null>;
  save(checkpoint: GraphCheckpoint<S>): Promise<void>;
  clear?(workflowId: string): Promise<void>;
}

/**
 * 默认内存实现，便于本地开发/测试
 */
export class InMemoryGraphCheckpointStore<S extends object> implements GraphCheckpointStore<S> {
  private readonly store = new Map<string, GraphCheckpoint<S>>();

  async load(workflowId: string): Promise<GraphCheckpoint<S> | null> {
    return this.store.get(workflowId) ?? null;
  }

  async save(checkpoint: GraphCheckpoint<S>): Promise<void> {
    this.store.set(checkpoint.workflowId, checkpoint);
  }

  async clear(workflowId: string): Promise<void> {
    this.store.delete(workflowId);
  }
}
