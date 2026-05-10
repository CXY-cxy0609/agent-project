import type { AgentContext } from './types.js';

export interface GraphExecutionControl {
  workflowId: string;
  resumeFromCheckpoint: boolean;
  clearCheckpointOnDone: boolean;
}

/**
 * 从 AgentContext.metadata 读取工作流控制参数
 * - workflowId: 可由上游显式传入，未传时自动基于 session+trace 生成
 * - resumeFromCheckpoint: 是否尝试断点续跑
 * - clearCheckpointOnDone: 成功完成后是否自动清理 checkpoint
 */
export function resolveGraphExecutionControl(
  ctx: AgentContext,
  graphName: string,
): GraphExecutionControl {
  const metadata = (ctx.metadata ?? {}) as Record<string, unknown>;

  const workflowBaseId =
    typeof metadata.workflowId === 'string'
      ? metadata.workflowId
      : `${ctx.sessionId}:${ctx.traceId}`;

  return {
    workflowId: `${workflowBaseId}:${graphName}`,
    resumeFromCheckpoint: metadata.resumeFromCheckpoint === true,
    clearCheckpointOnDone: metadata.clearCheckpointOnDone === true,
  };
}
