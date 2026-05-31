# 企业级流式输出设计方案（SSE 优先）

## 1. 目标与约束

- 低延迟首包：首个 token P95 < 800ms（缓存命中时更低）。
- 可恢复：前端断线后可在会话内续传，避免整段重生。
- 可观测：按 `trace_id / request_id / session_id` 全链路追踪。
- 多租户隔离：按用户、租户、模型维度限流与审计。
- 与网关兼容：Nginx/Ingress 不缓冲 SSE。

## 2. 协议选择

- 默认：`SSE`（浏览器友好、实现成本低、单向流足够）。
- 升级：`WebSocket`（双工场景：协同编辑、实时控制）。
- 大规模广播：配合消息总线（Kafka/NATS）做 fan-out，不由应用实例直接扛所有连接。

## 3. API 契约建议

- `POST /api/chat/stream/start`：创建流式任务，返回 `stream_id`、`session_id`、`resume_token`。
- `GET /api/chat/stream/events?stream_id=...`：SSE 通道，事件如下：
  - `start`：初始化上下文、模型信息。
  - `delta`：增量 token（可携带序号 `seq`）。
  - `tool_call` / `tool_result`：工具调用与结果摘要。
  - `heartbeat`：心跳（建议 10~15s）。
  - `done`：结束事件，包含 usage、耗时、内容 hash。
  - `error`：结构化错误码（可重试/不可重试）。
- `POST /api/chat/stream/cancel`：幂等取消。

## 4. 可靠性与恢复

- 事件持久化：将 `delta` 按 `stream_id + seq` 写入 Redis Stream / Kafka（短期保留）。
- 断线恢复：客户端携带 `Last-Event-ID` 或 `resume_token`，服务端从 `seq+1` 回放。
- 幂等：`Idempotency-Key` + 请求摘要，避免重复扣费与重复任务。
- 超时策略：
  - 首包超时（如 10s）；
  - 空闲超时（如 60s）；
  - 总时长上限（如 10min）。

## 5. 性能与容量规划

- 单实例连接预算：按 CPU/内存测得安全阈值（例如 2k~5k SSE 连接/实例）。
- 背压策略：
  - 发送队列上限；
  - 慢消费者自动降采样（批量 delta）；
  - 超阈值断开并可恢复。
- 网关配置：
  - `proxy_buffering off`；
  - 适当调大 `read_timeout`；
  - HTTP/2 优先。

## 6. 安全与治理

- 鉴权：短期访问令牌 + 流式专用 scope。
- 数据脱敏：日志中不落原文，仅落摘要与指标。
- 内容安全：输出前后置审查（策略引擎），高风险事件立即中断并返回 `error`。
- 限流：用户/租户/接口三级令牌桶，峰值保护与熔断。

## 7. 可观测性

- 指标：
  - `stream_ttfb_ms`、`stream_duration_ms`、`stream_tokens_total`；
  - `stream_disconnect_rate`、`stream_resume_success_rate`；
  - `provider_error_rate`、`tool_error_rate`。
- 日志：结构化日志统一字段
  - `request_id`、`trace_id`、`stream_id`、`session_id`、`user_id`、`tenant_id`。
- Tracing：
  - span 切分：鉴权、上下文检索、模型调用、工具调用、持久化、推流。

## 8. 在当前项目的落地步骤（建议）

1. 在 `apps/server` 增加 `chat stream gateway`（仅做鉴权、会话、审计、指标、SSE 输出）。
2. 与 `apps/agent` 通过内部事件协议对接（`start/delta/done/error`）。
3. 引入 Redis Stream 做短期事件持久化，实现断线恢复。
4. 将会话消息写入 DB（用户消息、助手最终消息 + usage 元信息）。
5. 逐步引入限流、熔断、灰度发布和压测基线（k6 + 长连接场景）。

