# 企业级会话存储与检索优化方案（DB + OSS 分层）

## 1. 背景与问题

当前对话消息（尤其是 assistant 长文本）直接写入 `conversation_message.content`，在会话规模上升后会出现以下问题：

- 单表数据量和行宽增长快，查询与排序开销上升。
- 前端会话拉取时，历史长文本传输慢，首屏延迟变高。
- 若仅靠 `conversation_id + role + created_at`，用户问题与对应回答存在歧义风险。
- 单会话内消息完全依赖后端拼装返回，缺少可控的冷热分层与精确关联模型。

目标：在不牺牲可检索性和可审计性的前提下，降低数据库压力并提升会话读取性能。

---

## 2. 设计原则

- **可定位**：任意 assistant 回复都能精确定位对应 user 问题。
- **可扩展**：支持长文本、富文本、未来多模态附件扩展。
- **可检索**：保留消息维度索引、统计、审计能力。
- **可恢复**：流式生成中断可追踪，落库状态清晰。
- **可演进**：支持平滑迁移，不中断现有业务。

---

## 3. 核心结论

1. **不建议继续“全文全量只存 DB content”**。  
2. **建议采用“元数据入库 + 内容外置 OSS + 热冷分层”**。  
3. **必须引入轮次关联键（`turn_id` / `reply_to_message_id`）**，解决问答错位问题。  
4. **不建议把整个会话压成单字段作为唯一真相源**；可选“会话快照”做加速层，而非主存储。

---

## 4. 数据模型建议

### 4.1 `conversation_message`（主表，保留行存）

建议新增/调整字段：

- `id`：主键
- `conversation_id`：会话 ID
- `seq`：会话内严格递增序号（唯一）
- `role`：`user` / `assistant` / `tool` / `system`
- `turn_id`：同一轮问答共享 ID（强烈建议）
- `reply_to_message_id`：assistant 显式指向其回答的 user message
- `status`：`streaming` / `done` / `error` / `cancelled`
- `content_inline`：短文本或摘要（例如前 2KB）
- `content_ref`：外部内容指针（OSS key / URI）
- `content_hash`：内容哈希（防篡改与去重）
- `content_size`：内容大小（字节）
- `token_count_prompt` / `token_count_completion`
- `created_at` / `updated_at`

> 兼容策略：`content` 字段可先保留，迁移期作为回退源，后续逐步收敛到 `content_inline + content_ref`。

### 4.2 索引建议

- `uniq_conversation_seq (conversation_id, seq)`
- `idx_conversation_created (conversation_id, created_at)`
- `idx_conversation_turn (conversation_id, turn_id)`
- `idx_reply_to_message (reply_to_message_id)`
- `idx_status_created (status, created_at)`（用于任务巡检与补偿）

---

## 5. 内容外置（OSS）方案

## 5.1 外置触发策略

- 超长消息（如 > 8KB / 16KB）首写即外置。
- 历史冷数据（如超过 7~30 天）异步归档到 OSS。
- 热数据窗口（近 N 条/近 N 天）保留 DB 内联，保证首屏性能。

### 5.2 对象命名建议

`chat/{env}/{yyyy}/{mm}/{dd}/{conversation_id}/{message_id}-{sha256}.txt`

字段落库：

- `content_ref`: 对象 key
- `content_hash`: sha256
- `content_size`: 字节数
- `content_inline`: 截断摘要（用于列表与快速展示）

### 5.3 读取策略

1. 先查消息元数据列表（分页，按 `seq`）。  
2. 识别 `content_ref` 记录并批量并行回源 OSS。  
3. 在服务端合并完整内容后返回前端。  
4. 对高频会话增加短 TTL 缓存（Redis）减少重复回源。

---

## 6. 问答关联与可追溯性

为避免“用户某个问题对应不了具体回答”，建议强制执行以下规则：

- 每个 user 消息创建唯一 `turn_id`。
- 同轮 assistant 消息复用该 `turn_id`，并填写 `reply_to_message_id=user_message.id`。
- 多次追问时新建 `turn_id`，不要复用旧轮次。
- 若出现工具调用，可在同 `turn_id` 下记录 `tool` 角色消息，保持完整链路。

这样可直接按 `turn_id` 聚合单轮数据，或按 `reply_to_message_id`做一对一反查。

---

## 7. 为什么不建议“整会话一个字段直接返回”

把整个会话序列存成单字段（大 JSON）可作为缓存快照，但不应作为唯一主存储，原因：

- 更新写放大：每新增一条都要重写整块。
- 并发冲突高：流式输出 + 用户新消息容易覆盖。
- 索引与检索弱：无法高效按消息维度检索、审计、统计。
- 故障隔离差：单条损坏影响整会话。
- 成本不可控：大字段频繁读写带来 I/O 浪费。

**折中方案**：保留行存主表 + 增加 `conversation_snapshot`（加速读）作为缓存层。

---

## 8. 读写链路（建议）

### 8.1 写入链路（单轮）

1. 插入 user message（`status=done`，分配 `turn_id`）。  
2. 插入 assistant message（`status=streaming`，关联 `reply_to_message_id`）。  
3. 流式阶段仅更新缓存或临时缓冲。  
4. 生成结束后按大小决策：写 `content_inline` 或上传 OSS 并写 `content_ref`。  
5. 回填 usage 与状态（`done/error`）。

### 8.2 读取链路（会话）

1. 分页查询消息元数据。  
2. 批量补全外置内容。  
3. 按 `seq` 输出；可附带 `turn_id` 供前端聚合与渲染。  
4. 可选：更新/返回会话快照缓存。

---

## 9. 迁移方案（无中断）

### Phase 1：字段与索引准备

- 增加 `turn_id`、`reply_to_message_id`、`content_inline`、`content_ref` 等字段。
- 增加必要索引，不改变现有读写逻辑。

### Phase 2：新写入切换

- 新消息按新模型写入（仍兼容旧 `content`）。
- 对超长消息启用 OSS 外置。

### Phase 3：历史数据回填

- 后台任务扫描历史长文本，迁移到 OSS。
- 回填 `content_ref/content_hash/content_size`，`content_inline` 存摘要。

### Phase 4：读链路优化

- 读链路优先 `content_ref` + `content_inline`，旧字段作为兜底。
- 引入热会话缓存与监控指标。

---

## 10. 监控与治理

关键指标建议：

- 会话加载：`chat_load_p95_ms`、`message_query_p95_ms`
- 回源质量：`oss_fetch_p95_ms`、`oss_fetch_error_rate`
- 数据规模：`conversation_message_row_growth`、`avg_row_size`
- 关联准确性：`missing_reply_to_ratio`、`missing_turn_id_ratio`
- 任务健康：`streaming_timeout_count`、`finalize_fail_count`

---

## 11. 风险与对策

- **OSS 可用性风险**：增加重试 + 降级读取（旧 content）+ 本地缓存。
- **迁移期间一致性风险**：双写校验 + 灰度发布 + 可回滚开关。
- **回源延迟风险**：批量并发回源 + CDN/缓存 + 热数据内联。
- **历史脏数据风险**：离线校验脚本（hash/size/null ref）。

---

## 12. 结论

针对当前问题，推荐采用：

- 行存主表（消息元数据与关联关系）  
- 长文本外置 OSS（降低 DB 压力）  
- `turn_id + reply_to_message_id` 保证问答精确定位  
- 会话快照仅作加速层，不作唯一存储  

该方案兼顾性能、可维护性、可审计性与未来扩展能力，适合企业级演进路径。

