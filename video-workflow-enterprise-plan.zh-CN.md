# 教学视频工作流企业级改造方案（中文）

## 1. 背景与目标

当前教学视频生成链路已经可用，但在企业级交付层面仍存在以下问题：

- 过程不可审计：缺少可回溯的运行级产物沉淀
- 故障排查成本高：脚本多轮生成/修复信息未结构化留存
- 资产分散：视频、日志、状态没有统一索引
- 多模态成本高：图片在多节点重复传递，token 消耗大
- 编排边界不清晰：视频能力未作为问答流程中的“按需子图”治理

本方案目标：

1. 建立**可审计、可追溯、可复盘**的视频运行体系  
2. 建立**对象存储为主、数据库索引为辅**的低成本持久化模式  
3. 建立**图片一次语义化**的多模态降本机制（非 OCR 抄录）  
4. 将视频生成为 QA 编排中的**可选 subgraph**，避免误触发

---

## 2. 设计原则

- **企业可观测优先**：每次运行必须有唯一 run_id 与完整运行档案
- **主链路稳定优先**：日志/归档失败不阻断用户核心响应
- **存储分层**：DB 存索引，OSS/COS 存大文件与完整归档
- **最小重复计算**：图片只做一次语义提取，后续节点复用文本语义
- **强约束触发**：无视频诉求时，不执行视频子图

---

## 3. 目标架构（端到端）

```mermaid
flowchart TD
  userInput[用户输入(文本/图片)] --> orchestrator[Orchestrator]
  orchestrator --> intentClassify[意图识别]
  intentClassify -->|需要视频| imageSemantic[图片语义化(一次)]
  intentClassify -->|仅问答| qaOnly[QA子图]
  imageSemantic --> videoSubgraph[Video子图]
  videoSubgraph --> artifactWrite[运行产物写入]
  videoSubgraph --> renderUpload[渲染与视频上传]
  artifactWrite --> archivePack[目录归档与manifest]
  archivePack --> cosUpload[归档上传COS]
  renderUpload --> videoUrl[视频URL]
  cosUpload --> bundleUrl[归档URL]
  videoUrl --> runPersist[运行索引写DB]
  bundleUrl --> runPersist
  runPersist --> frontendResp[前端展示视频URL]
```

---

## 4. 运行目录与产物规范

根目录：`apps/manim-project/.temp-project`

建议结构：

```text
{date}/{workflowId}_{traceId}_{runId}/
  intent-classification.json
  image-semantic.json                  # 有图时
  storyboard.json
  scripts/
    script-v1.py
    script-v1.meta.json
    script-v2.py
    script-v2.meta.json
  render/
    render-attempt-1.json
    render-attempt-2.json
  result.json
  manifest.json
```

### 文件语义

- `intent-classification.json`：意图识别原始结果（intent/confidence/video_required/reasoning）
- `image-semantic.json`：图片语义重建结构化结果（题意、图形关系、已知条件、目标）
- `storyboard.json`：分镜结构化 JSON
- `script-vN.py`：第 N 次生成/修复后的可运行脚本
- `script-vN.meta.json`：策略、来源、校验结果、错误摘要
- `render-attempt-N.json`：渲染输入摘要、返回错误、耗时、产物路径
- `result.json`：最终状态、videoUrl、artifactBundleUrl、manifestUrl
- `manifest.json`：目录内文件清单、hash、大小、时间戳

---

## 5. 对象存储策略（COS）

### 5.1 双上传策略

1. **视频上传（现有链路）**：供前端直接播放  
2. **运行归档上传（新增）**：供审计/排障/回放

### 5.2 对象键规范

- 视频对象：`videos/{timestamp}.mp4`（或业务化路径）
- 归档对象：`video-runs/{yyyy}/{mm}/{dd}/{workflowId}/{traceId}/{runId}/run-bundle.tar.gz`
- 清单对象：`video-runs/{...}/manifest.json`

---

## 6. 数据持久化模型（轻库重存储）

新增表：`video_generation_runs`

建议字段：

- 标识：`run_id`, `workflow_id`, `trace_id`, `session_id`, `user_id`
- 状态：`status`（running/completed/failed）
- 索引数据：`video_url`, `artifact_bundle_url`, `manifest_url`
- 过程摘要：`intent_json`, `error_summary`
- 时间：`created_at`, `updated_at`

说明：  
DB 只做检索与定位；完整上下文在 COS 归档内。

---

## 7. 图片语义前处理（非 OCR）

### 7.1 触发条件

- 输入包含图片时，仅在编排前执行一次

### 7.2 目标输出

输出应覆盖：

- 完整题目语义（不是逐字 OCR）
- 图形结构与几何/坐标关系
- 已知条件与约束
- 求解目标
- 可直接复用的语义摘要

### 7.3 复用策略

- QA 与 Video 下游统一消费 `image-semantic` 文本
- 下游节点不再重复传图给大模型

---

## 8. 视频作为 QA 可选 Subgraph

### 8.1 显式 gating

仅满足以下条件之一才触发视频：

- 前端显式 `generateVideo=true`
- 意图识别 `video_required=true`
- 用户文本明确视频生成诉求（规则命中）

默认 QA 路径不触发视频子图，避免成本与时延漂移。

### 8.2 响应分离

对外响应保留：

- `reply`（文本回复）
- `videoUrl`（可选）
- `videoRunId` / `artifactBundleUrl`（可选，调试与运营）

---

## 9. 可观测性与运维

### 9.1 指标建议

- 视频生成成功率、失败率
- 平均渲染耗时、上传耗时
- 平均脚本修复轮次
- 归档上传失败率

### 9.2 日志建议

- 每次运行统一 run_id
- 所有节点日志可通过 run_id 检索
- 错误日志需包含 trace_id + workflow_id + run_id

### 9.3 生命周期管理

- 本地 `.temp-project` 设置 TTL 清理任务
- COS 设置生命周期策略（冷热分层/到期归档）

---

## 10. 分阶段落地计划

### Phase 1：可追溯最小闭环

- 本地运行目录与产物落盘
- 生成 `manifest.json`
- 主链路继续返回视频 URL

### Phase 2：归档与索引

- 运行目录打包上传 COS
- 新增 `video_generation_runs` 表与写入服务
- 返回归档索引字段

### Phase 3：多模态与编排治理

- 上线图片语义前处理 schema
- QA/Video 统一复用语义文本
- 完成视频子图 gating 治理

### Phase 4：企业增强

- 幂等去重（run_id）
- 预算治理（token/耗时/大小）
- 监控告警与自动化回归

---

## 11. 风险与应对

- **风险：归档上传失败影响主链路**  
  应对：归档失败降级，不影响视频 URL 返回

- **风险：图片语义误解导致下游偏差**  
  应对：保留原始用户文本并与语义摘要联合输入

- **风险：本地临时目录膨胀**  
  应对：定时清理 + 失败重试次数上限 + 大文件阈值策略

- **风险：误触发视频子图导致成本上升**  
  应对：多因子 gating + 默认关闭 + 审计抽样

---

## 12. 验收标准（Definition of Done）

- 任意一次视频任务可通过 run_id 在 DB 查到索引记录
- 可通过 artifactBundleUrl 下载完整运行包进行复盘
- 有图任务仅发生一次图片语义化调用
- 无视频诉求的 QA 请求不触发视频子图
- 主链路在归档失败场景仍可返回可用回复（含可用 videoUrl 或明确失败原因）

