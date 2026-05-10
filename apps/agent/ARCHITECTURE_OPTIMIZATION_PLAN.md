# Agent 架构优化技术方案（对齐 Claude Code 思路）

## 1. 背景与目标

当前 `apps/agent` 已具备清晰的多 Agent + StateGraph 架构，核心链路稳定：

- 主链路：`OrchestratorAgent -> QAAgent -> VideoAgent`
- QA 子图：`ocr -> rag -> generate -> video`
- Video 子图：`checkCache -> generateStoryboard -> generateScript -> renderManim -> fixScript -> uploadVideo`

本次优化目标：

1. **核心功能不变**：对外接口、主业务流程、Agent 职责保持一致。
2. **推理方式升级**：从“单次生成”升级为“可收敛的分阶段推理循环”。
3. **增强 Manim 自修复**：基于已有代码与错误信息做高成功率修复。
4. **新增截图改稿能力**：用户可上传截图，按对应代码进行定向调整。
5. **优化记忆与成本**：解决图像输入高 token 成本，兼顾效果与延迟。

---

## 2. 当前系统评估（简要）

### 2.1 优势

- 分层合理（HTTP / Agent / Harness / Tool / 外部依赖），演进空间大。
- Graph 显式流程可观测，便于插入新节点和条件路由。
- 已有缓存、重试、YAML 结构化输出、异步事件总线等工程能力。
- Video 链路已有 `render -> fix -> retry` 的初版闭环。

### 2.2 主要痛点

- 关键节点仍以“一次 LLM 调用”完成复杂任务，缺少系统化自检与收敛机制。
- Manim 修复策略较单一，容易进入“全量重写但不稳定”的循环。
- 截图需求仅能走 OCR 补文本，缺少“视觉差异 -> 代码定位 -> 精准 patch”能力。
- 会话记忆以原始消息为主，图像内容复用率低，token 成本高。

---

## 3. 总体设计：双层图 + 可控推理循环

在保持现有业务图的前提下，引入“节点内推理微循环（Reasoning Loop）”。

### 3.1 双层结构

1. **业务编排层（保留）**
   - 继续使用 `StateGraph` 编排业务节点与条件跳转。

2. **节点推理层（新增）**
   - 在复杂节点内部采用统一流程：
     - `Plan`：输出任务计划与约束
     - `Execute`：执行生成
     - `Verify`：结构/规则/目标校验
     - `Repair`：最小修复后回验

该模式可用于：

- QA 的 `generate`
- Video 的 `generateScript` 与 `fixScript`
- 新增截图改稿链路中的 `editByScreenshot`

### 3.2 设计原则

- **先规则后模型**：可规则修复就不走大模型。
- **先局部后全量**：优先 patch，最后才 full rewrite。
- **先复用后重算**：先查视觉记忆与脚本版本，再触发图像理解。
- **每步可观测**：记录耗时、token、失败原因、路由决策。

---

## 4. 推理方式优化方案

## 4.1 新增 `ReasoningLoop` 抽象（Harness 层）

建议新增模块：`src/harness/reasoning/loop.ts`

统一接口示意：

- 输入：`goal`, `constraints`, `context`, `budget`, `validators`
- 输出：`result`, `attempts`, `verification`, `trace`

关键能力：

- 最大步数限制（防止无限循环）
- 可插拔验证器（Schema、Manim 规则、内容完整性）
- 失败升级策略（轻修复 -> 重修复）

## 4.2 节点接入策略

- `qa.graph.ts/generateNode`
  - 加入生成后校验（必填字段、答案完整性、视频意图一致性）
- `video.graph.ts/generateManimScriptNode`
  - 先产出脚本计划摘要，再生成代码，增加语法和约束预校验
- `video.graph.ts/fixManimScriptNode`
  - 从“直接重写脚本”改为“策略路由 + 分级修复”

---

## 5. Manim 报错自修复增强

## 5.1 分级修复架构

新增模块建议：

- `src/harness/video/error-classifier.ts`
- `src/harness/video/fix-policy.ts`
- `src/harness/video/script-validator.ts`

流程：

1. **错误分型**（语法/导入/API误用/对象属性/时序/环境依赖）
2. **策略路由**
   - Rule Patch（0 token）
   - Local LLM Patch（低 token）
   - Full Rewrite（高 token，最后手段）
3. **修复后验证**
   - Python 语法检查
   - 关键约束检查（必须含 Scene、必要 import 等）
   - 再进入渲染

## 5.2 状态扩展（`VideoState`）

建议新增字段：

- `scriptVersion: number`
- `errorType?: string`
- `fixStrategy?: 'rule' | 'local_patch' | 'full_rewrite'`
- `fixHistory: Array<{ attempt: number; strategy: string; reason: string }>`
- `validationReport?: string`

## 5.3 收敛策略

- 每轮修复必须记录“变更点 + 原因”。
- 若同类错误重复出现超过阈值，自动升级策略。
- 达到上限仍失败时，返回结构化失败报告（便于前端提示用户下一步）。

---

## 6. 新增：截图驱动代码改稿能力

## 6.1 新意图与新子图

在 Orchestrator 增加意图：

- `video_edit`（或 `scene_edit`）

新增 Video Edit 子图（可在 `VideoAgent` 内作为分支，或独立 `VideoEditAgent`）：

1. `loadContext`：加载最近脚本版本、渲染结果、关联视觉记忆
2. `analyzeScreenshot`：视觉结构化理解（非 OCR-only）
3. `mapToCode`：视觉问题映射到代码符号/区域
4. `patchScript`：定向修改代码
5. `rerender`：渲染并产出新视频
6. `summarizeDiff`：输出改动说明与对比信息

## 6.2 视觉分析输出结构（建议）

```yaml
image_id: <hash>
detected_elements:
  - type: title
    bbox: [x, y, w, h]
    text: "二次函数基础"
layout_issues:
  - "标题偏小"
  - "公式区域偏下"
edit_intents:
  - target: title
    action: increase_font_size
    confidence: 0.91
```

## 6.3 代码映射策略

- 基于 AST + 规则映射：
  - 标题 -> `set_title(...)`
  - 副标题 -> `set_subtitle(...)`
  - 内容区文本 -> `show_center_text(...)` / `show_two_columns(...)`
  - 公式 -> `create_math_formula(...)` / 公式对象位置设置
- 映射失败时，再走 LLM 辅助定位（降级路径）。

---

## 7. 记忆系统与成本优化

## 7.1 从“原始会话历史”升级为“多层记忆”

1. **Working Memory（会话工作记忆）**
   - 当前目标、上次错误、当前脚本摘要、待办修改项

2. **Visual Memory（视觉记忆）**
   - `image_id`, `visual_summary`, `layout_slots`, `ocr_text`, `embedding`
   - 同图/近似图复用解析结果，避免重复看图

3. **Code Memory（代码记忆）**
   - 脚本版本、Diff、渲染结果、关联 image_id

## 7.2 图像成本控制（Budget Controller）

新增 `src/harness/reasoning/budget-controller.ts`：

- 为每类请求设预算档位（QA / 首次改稿 / 连续改稿）
- 限制“高成本视觉分析”触发频率（如每 N 轮最多 1 次）
- 优先走缓存复用：
  1. 命中 Visual Memory -> 直接用摘要
  2. 未命中才触发 Vision 模型

## 7.3 Prompt 缩减策略

- 历史消息不再盲目拼接，改为：
  - `短窗口原文 + 结构化摘要`
- 图片不重复内联 base64，改为：
  - `image_id + prior visual summary + 必要局部引用`

---

## 8. 目录与模块改造建议

建议新增（示例）：

```text
src/harness/reasoning/loop.ts
src/harness/reasoning/budget-controller.ts
src/harness/vision/visual-memory.ts
src/harness/video/error-classifier.ts
src/harness/video/fix-policy.ts
src/harness/video/script-validator.ts
src/harness/video/scene-mapper.ts
src/agents/video-edit/video-edit.agent.ts   # 可选：独立 Agent
```

建议修改（示例）：

- `src/agents/video/video.graph.ts`
- `src/agents/orchestrator/orchestrator.agent.ts`
- `src/harness/memory/short-term.ts`
- `src/harness/memory/vector-memory.ts`
- `src/tools/image-ocr.tool.ts`（扩展视觉结构化输出）

---

## 9. 分阶段实施计划

## Phase 1：推理与修复收敛（低风险，优先）

- 引入 `ReasoningLoop`（先接 `generateScript` / `fixScript`）
- 落地错误分型与分级修复策略
- 增加修复历史、验证报告与关键指标埋点

**验收标准**：

- Manim 渲染成功率提升
- 平均修复轮数下降
- 失败可解释性明显提升

## Phase 2：截图改稿主能力

- 增加 `video_edit` 意图与流程
- 接入视觉分析 -> 代码映射 -> patch -> rerender 闭环

**验收标准**：

- 用户可通过截图驱动代码改稿并得到新结果
- 改稿链路具备稳定回退和失败说明

## Phase 3：记忆与成本优化

- 上线 Visual Memory 与 Budget Controller
- 优化历史拼接策略与图像复用机制

**验收标准**：

- 图像相关 token 显著下降
- 同等质量下平均响应时延下降或持平

---

## 10. 可观测性与评估指标

核心指标：

- `video_render_success_rate`
- `manim_fix_attempt_avg`
- `video_edit_success_rate`
- `image_token_per_session`
- `cache_hit_rate_visual_memory`
- `p95_latency_ms`

建议在 `observer/metrics.ts` 增加节点级标签：

- `node_name`, `reasoning_step`, `fix_strategy`, `error_type`, `budget_tier`

---

## 11. 风险与应对

- **风险：流程变复杂导致延迟上升**
  - 应对：预算闸门 + 规则修复优先 + 分级降级
- **风险：视觉映射不准确导致误改代码**
  - 应对：先局部 patch、强制 rerender 验证、提供 diff 解释
- **风险：记忆系统膨胀**
  - 应对：TTL + 摘要化 + 版本裁剪策略
- **风险：模型输出不稳定**
  - 应对：结构化 schema + 验证器 + 自动重试策略

---

## 12. 结论

该方案在不改变现有核心功能和主链路的前提下，通过“节点内推理循环 + 分级修复 + 截图改稿 + 多层记忆与预算控制”，实现以下提升：

- 推理过程更稳、更可收敛
- Manim 报错修复成功率更高
- 支持用户基于截图进行代码级迭代
- 在图片场景下更好平衡成本、效果与时延

可先按 Phase 1 快速落地，验证收益后逐步扩展到 Phase 2/3。
