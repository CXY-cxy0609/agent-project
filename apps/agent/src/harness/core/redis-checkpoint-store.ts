/**
 * Redis Checkpoint Store
 * 生产环境可使用 Redis 持久化工作流状态
 */
import type Redis from 'ioredis';
import type { GraphCheckpoint, GraphCheckpointStore } from './checkpoint.js';

export class RedisGraphCheckpointStore<S extends object> implements GraphCheckpointStore<S> {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix = 'agent:graph:checkpoint',
  ) {}

  async load(workflowId: string): Promise<GraphCheckpoint<S> | null> {
    const raw = await this.redis.get(this.getKey(workflowId));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as GraphCheckpoint<S>;
    } catch {
      return null;
    }
  }

  async save(checkpoint: GraphCheckpoint<S>): Promise<void> {
    await this.redis.set(this.getKey(checkpoint.workflowId), JSON.stringify(checkpoint));
  }

  async clear(workflowId: string): Promise<void> {
    await this.redis.del(this.getKey(workflowId));
  }

  private getKey(workflowId: string): string {
    return `${this.keyPrefix}:${workflowId}`;
  }
}
