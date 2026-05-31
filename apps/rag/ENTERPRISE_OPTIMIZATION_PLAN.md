# RAG 企业级优化方案（第一版）

## 1. 目标与范围

本方案面向 `apps/rag`，目标是将当前“可用版 RAG 服务”升级为“可规模化、可治理、可审计”的企业级服务，重点覆盖：

- 可靠性与稳定性（SLA/SLO、降级、熔断）
- 安全与权限（鉴权、租户隔离、审计）
- 性能与成本（吞吐、时延、缓存、资源分层）
- 可观测与运维（指标、追踪、告警、容量规划）

不包含：

- 模型效果 prompt 微调细节
- 前端交互层改造

---

## 2. 当前问题盘点（As-Is）

### 2.1 安全与访问控制

- CORS 允许所有来源，管理类写接口缺少强制内部鉴权。
- 发生异常时直接回传 `str(e)`，存在内部信息泄露风险。

### 2.2 稳定性与服务治理

- 检索、向量化、重排等重计算路径主要在在线请求中执行，峰值时容易拖慢整体响应。
- 缺少系统化超时预算、熔断与分级降级策略。

### 2.3 可观测性

- 目前以日志为主，缺少统一 metrics 与 tracing。
- 无标准化的 SLA 看板、告警规则与容量基线。

### 2.4 数据与索引治理

- 文档写入幂等策略不足（重复上传、增量更新、版本回滚能力弱）。
- 租户/业务隔离维度未形成强约束（更多依赖调用方自觉传参）。

---

## 3. 目标架构（To-Be）

## 3.1 分层模型

1. API Gateway 层
   - 鉴权、限流、审计、请求 ID 注入
2. Query 服务层（在线）
   - 轻量检索路径，强时延约束，支持降级
3. Index 服务层（异步）
   - 文档解析、切块、向量化、写库，任务化执行
4. 存储与索引层
   - Qdrant（向量）、Redis（缓存）、对象存储（原文与工件）
5. 观测与治理层
   - OpenTelemetry + Prometheus + Grafana + Alertmanager

## 3.2 关键原则

- 在线路径必须可降级：任何增强能力失败时回退到基础向量召回。
- 写入路径必须任务化：避免重计算占用在线请求线程。
- 强制租户隔离：每次读写都必须带 `tenant_id`，并在服务端校验。
- 全链路可追溯：每个请求、任务、索引版本都可回放与审计。

---

## 4. 核心改造方案

## 4.1 安全与权限

- 接口分级：
  - 公开读接口（如 `/retrieve`）：JWT 或服务 token
  - 内部写接口（`/index/*`, `/memory/*`）：`x-internal-token` + IP 白名单
- 统一中间件：
  - Request ID
  - 租户解析（`tenant_id`）
  - 速率限制（全局 + tenant + knowledge_base 维度）
- 错误脱敏：
  - 客户端仅返回标准错误码与 trace id
  - 详细错误只写日志

## 4.2 检索链路治理（在线）

- 节点级超时预算（示例）：
  - embedding: 300ms
  - vector search: 250ms
  - rerank: 400ms
  - context build: 100ms
- 降级顺序：
  1. 关闭 HyDE
  2. 关闭 reranker，保留 ANN
  3. 减小 top_k
  4. 返回“证据不足”标准响应
- 熔断策略：
  - 下游连续失败阈值触发短时熔断
  - 熔断窗口内走降级路径

## 4.3 索引链路治理（异步）

- 引入任务队列（Celery/RQ/Kafka 任一）：
  - API 只负责受理并返回 task_id
  - worker 异步执行 parse/chunk/embed/upsert
- 任务状态机：
  - `queued -> running -> succeeded | failed | cancelled`
- 重试策略配置化：
  - parser、embedder、vector-upsert 分别配置最大重试与退避参数

## 4.4 数据模型与幂等

- 新增核心字段：
  - `tenant_id`, `kb_id`, `doc_id`, `doc_version`, `content_hash`
- chunk 唯一键建议：
  - `tenant_id + doc_id + doc_version + chunk_index + content_hash`
- 支持：
  - 幂等重放（同版本覆盖）
  - 版本切换（A/B）
  - 软删除与延迟清理

## 4.5 可观测体系

- Metrics（Prometheus）：
  - `rag_request_total`, `rag_request_latency_ms`
  - `rag_retrieve_stage_latency_ms{stage=*}`
  - `rag_degrade_total{level=*}`
  - `embedding_cache_hit_ratio`
  - `qdrant_error_total`
- Tracing（OpenTelemetry）：
  - 每个检索阶段一个 span
  - 写入任务完整链路 span
- 日志：
  - JSON 结构化日志
  - 统一字段：`trace_id`, `tenant_id`, `kb_id`, `task_id`

---

## 5. API 与契约升级建议

## 5.1 Retrieve 请求契约（建议）

- 必填：`tenant_id`, `query`
- 可选：`kb_id`, `subject_id`, `top_k`, `retrieval_mode`, `latency_budget_ms`

## 5.2 索引接口契约（建议）

- 同步受理：
  - `POST /index/tasks` 返回 `task_id`
- 任务查询：
  - `GET /index/tasks/{task_id}`
- 结果幂等：
  - 客户端可传 `idempotency_key`

---

## 6. SLA/SLO 与告警

## 6.1 建议目标

- `/retrieve`：P95 < 800ms，P99 < 1500ms（基础降级路径）
- 写入受理接口：P95 < 150ms
- 写任务成功率：> 99.5%

## 6.2 告警策略

- 5 分钟窗口错误率 > 2%
- P95 连续 10 分钟超阈值
- Qdrant 连接错误突增
- embedding cache 命中率连续下降

---

## 7. 分阶段实施计划

## Phase 1（1-2 周）：安全与观测基线

- 鉴权中间件、错误码体系、脱敏输出
- Request ID + 结构化日志 + 基础 metrics

## Phase 2（2-3 周）：在线链路治理

- 检索节点超时预算、降级与熔断
- Qdrant 客户端池化与健康探针

## Phase 3（2-4 周）：异步索引与幂等

- 任务队列化与状态机
- 文档版本化与 chunk 幂等键

## Phase 4（持续）：容量与成本优化

- 压测与容量基线
- 模型/重排策略分层路由
- 缓存策略与索引参数持续调优

---

## 8. 验收标准

- 通过故障演练：Qdrant/Reranker 短时不可用时，服务仍可降级可用。
- 压测达标：检索时延与错误率满足 SLO。
- 追踪闭环：任意请求可通过 trace_id 回溯全链路。
- 索引一致性：重复提交同文档不产生重复脏数据。
