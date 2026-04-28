# Agent 服务

基于 TypeScript + Express 的智能体编排服务，是考研辅导平台的 AI 核心。对外提供 SSE 流式对话、知识库管理等 HTTP 接口，内部通过多 Agent 协作、Graph 状态机与事件总线串联完整的 AI 链路。

---

## 目录

- [1. 架构设计](#1-架构设计)
  - [1.1 分层架构](#11-分层架构)
  - [1.2 各层职责](#12-各层职责)
  - [1.3 Agent 目录](#13-agent-目录)
  - [1.4 主对话链路数据流](#14-主对话链路数据流)
  - [1.5 QA Agent 内部 Graph](#15-qa-agent-内部-graph)
  - [1.6 Video Agent 内部 Graph](#16-video-agent-内部-graph)
  - [1.7 事件总线与异步解耦](#17-事件总线与异步解耦)
- [2. 项目结构](#2-项目结构)
- [3. 运行方式](#3-运行方式)
- [4. HTTP 接口](#4-http-接口)
- [5. 联调建议](#5-联调建议)

---

## 1. 架构设计

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         HTTP 层（index.ts）                      │
│          Express · SSE 流式对话 · REST API · 健康检查             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    应用容器（container.ts）                       │
│            依赖注入 · 配置读取 · 实例组装 · 事件订阅               │
└───────┬───────────────────────────────────────────┬─────────────┘
        │                                           │
┌───────▼───────────────────────────────────────────▼─────────────┐
│                        Agent 层                                  │
│                                                                  │
│  ┌─────────────────────┐      ┌──────────────────────────────┐  │
│  │   OrchestratorAgent  │─────▶│         QAAgent              │  │
│  │  意图识别 · 任务路由  │      │  Graph：OCR→RAG→生成→视频    │  │
│  └─────────────────────┘      └──────────────┬───────────────┘  │
│           │                                  │                   │
│           │ (report 意图)                    │ (emit)            │
│           ▼                                  ▼                   │
│  ┌─────────────────────┐      ┌──────────────────────────────┐  │
│  │  LearningRecordAgent │◀─── │         EventBus             │  │
│  │  知识点提取 · 报告   │     │    fire-and-forget 异步通知   │  │
│  └─────────────────────┘      └──────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────┐      ┌──────────────────────────────┐  │
│  │    VideoAgent        │      │     KnowledgeBaseAgent        │  │
│  │  Graph：脚本→渲染    │      │   Pipeline：文档入库/删除     │  │
│  └─────────────────────┘      └──────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ 所有 Agent 依赖
┌───────────────────────────────▼─────────────────────────────────┐
│                       Harness 层（框架基础设施）                  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │ LLMClient│  │ Memory   │  │   Tool   │  │  Observer    │    │
│  │ 多Provider│  │三类记忆  │  │ Registry │  │ Trace/指标   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │StateGraph│  │RagClient │  │  Prompt  │  │SchemaParser  │    │
│  │ 状态机   │  │HTTP 封装  │  │ Builder  │  │ 结构化输出   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                      Tools 层（可插拔工具）                       │
│  rag-retrieval · image-ocr · file-parser · manim-runner · upload │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                       外部依赖                                    │
│  LLM API（Anthropic/豆包）  RAG 服务  后端服务  Redis  Manim     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.2 各层职责

| 层级 | 模块 | 职责 |
|---|---|---|
| **HTTP 层** | `src/index.ts` | 只处理传输协议：解析 HTTP 请求、写入 SSE 帧、统一错误格式，不包含业务逻辑 |
| **应用容器** | `src/container.ts` | 集中组装所有依赖（LLM、Memory、Tool、Agent），唯一知道所有组件如何连线的地方 |
| **Agent 层** | `src/agents/` | 各子 Agent 承载具体业务逻辑，推理模式各异（见下节），通过 `BaseAgent.callAgent()` 互调 |
| **Harness 层** | `src/harness/` | 框架基础设施：LLM 调用、状态机、记忆抽象、工具注册、Prompt 构建、可观测性 |
| **Tools 层** | `src/tools/` | 具体工具实现，遵循统一的 `ToolDefinition` 接口，由 `ToolRegistry` 统一管理 |

---

### 1.3 Agent 目录

系统共有 **5 个 Agent**，每个 Agent 根据任务复杂度选择不同的推理模式：

| Agent | 推理模式 | 职责 | LLM 用量 |
|---|---|---|---|
| **OrchestratorAgent** | Direct（单次 LLM 调用） | 意图分类（qa / video / report / knowledge_query）+ 路由到对应子 Agent | 低（快速模型） |
| **QAAgent** | ReAct / Graph（多步骤） | 核心问答：OCR → RAG 检索 → 生成回答 → 可选视频 | 高（智能模型） |
| **VideoAgent** | Plan-and-Execute / Graph | Manim 视频生成：脚本生成 → 渲染 → 失败重试 → 上传 | 中（含缓存命中短路） |
| **LearningRecordAgent** | Direct（单次 LLM 调用） | 从 QA 对话提取知识点并持久化；按需生成学情报告 | 低（快速模型） |
| **KnowledgeBaseAgent** | Pipeline（无 LLM） | 文档入库 / 删除：直接调用 RAG HTTP 接口，无需大模型推理 | 无 |

所有 Agent 继承自 `BaseAgent<TInput, TOutput>`，框架层在 `run()` 方法中统一包裹：
- **链路追踪**：自动 startSpan / endSpan，traceId 透传
- **错误处理**：捕获 execute() 异常，统一上报
- **子 Agent 调用**：通过 `callAgent()` 传递 ctx，确保 traceId 贯穿整条调用链

---

### 1.4 主对话链路数据流

```
前端
  │  POST /chat/stream { content, subjectId, conversationId, userId }
  ▼
index.ts
  │  建立 SSE 连接，emit start 事件
  ▼
OrchestratorAgent.run()
  │
  ├─① getHistory(sessionId)           ← ShortTermMemory (Redis / 内存)
  │
  ├─② classifyIntent(userMessage)     ← LLM 快速模型，温度=0
  │   返回 { intent, subjectId, confidence }
  │
  ├─③ 意图路由
  │   ├─ qa / video_request  ──────────▶ QAAgent.run()  (见 1.5)
  │   ├─ learning_report     ──────────▶ LearningRecordAgent.run(generate_report)
  │   └─ 其他意图            ──────────▶ 兜底回复
  │
  ├─④ appendHistory(sessionId, [user, assistant])
  │
  └─⑤ return { reply, intent, videoUrl, conversationId }
       │
       ▼
index.ts  emit reply → done 事件
前端
```

---

### 1.5 QA Agent 内部 Graph

QA Agent 使用 `StateGraph` 实现 4 节点的有向图，节点之间通过状态对象（`QAState`）传递数据：

```
QAState 初始化
     │
     ▼
 ┌───────┐       有图片输入时调用 image-ocr 工具
 │  ocr  │       提取图片文字，追加到 question
 └───┬───┘
     │
     ▼
 ┌───────┐       调用 RAG 服务做语义检索
 │  rag  │       返回相关知识片段（context）
 └───┬───┘
     │
     ▼
 ┌──────────┐    携带 history + context 调用 LLM
 │ generate │    生成 answer，提取 knowledgePoints、difficulty
 └────┬─────┘
      │
   条件边：是否需要视频？
      ├─ yes ──▶ ┌───────┐  调用 VideoAgent（Plan-and-Execute 子图）
      │           │ video │  返回 videoUrl
      │           └───┬───┘
      │               │
      └─ no ──────────┤
                      ▼
                     END
                      │
                      ▼（emit 异步事件）
            EventBus → LearningRecordAgent.record()
```

节点的返回值是 `Partial<QAState>`，框架做浅合并（`Object.assign`），下一节点拿到合并后的完整状态。

---

### 1.6 Video Agent 内部 Graph

Video Agent 实现 **Plan-and-Execute** 模式，内置缓存命中短路和渲染失败重试机制：

```
VideoState 初始化
     │
     ▼
 ┌────────────┐
 │ checkCache │  向量相似度检索已有视频（阈值 0.92）
 └─────┬──────┘
       │
    条件边：缓存命中？
       ├─ cached ──▶ ┌─────────────┐
       │              │ returnCached│──▶ END  （直接返回，跳过生成）
       │              └─────────────┘
       │
       └─ generate
             │
             ▼
      ┌──────────────────┐
      │ generateStoryboard│  LLM 生成分镜结构
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │ generateScript   │  LLM 生成 Manim Python 代码
      └────────┬─────────┘
               │
               ▼
      ┌──────────────────┐
      │  renderManim     │  调用 Manim 渲染服务执行代码
      └────────┬─────────┘
               │
          条件边：渲染结果？
               ├─ success ──▶ ┌────────────┐
               │               │ uploadVideo│──▶ END  （写入对象存储 + 向量缓存）
               │               └────────────┘
               ├─ retry ───▶ ┌────────────┐
               │              │ fixScript  │  LLM 修复报错代码，回到 renderManim
               │              └────────────┘
               └─ fail ────▶ END  （超出重试次数，降级无视频）
```

---

### 1.7 事件总线与异步解耦

学情记录写入不在主对话链路上，通过 **fire-and-forget 事件总线** 完全解耦：

```
QAAgent.execute()
    │
    ├─ 返回 answer 给 OrchestratorAgent（同步）
    │
    └─ emit(EVENTS.QA_COMPLETED, { question, answer, knowledgePoints, ... })
         │                          （setImmediate，不阻塞当前事件循环）
         ▼
    EventBus（AgentEventBus extends EventEmitter）
         │
         ▼
    container.ts 中注册的订阅者
         │
         └─ LearningRecordAgent.run({ action: 'record', ... })
                │
                ├─ LLM 提取结构化知识点
                └─ StructuredMemory.write()  →  后端 API 持久化
```

这个模式保证：QA 对话始终在 ~1s 内返回，学情数据最终一致性写入，失败仅打印日志不影响用户。

---

### Harness 层关键模块说明

#### LLMClient（多 Provider）

通过 `LLM_PROVIDER` 环境变量选择 Provider，对 Agent 层透明：

```
createLLMClient(config)
    ├─ provider=anthropic  →  AnthropicLLMClient（使用 @anthropic-ai/sdk）
    │                          支持 extended thinking、prompt cache
    └─ provider=doubao     →  DoubaoLLMClient（使用 openai SDK 兼容接口）
                               支持图片输入、工具调用、流式输出
```

#### 三类记忆

| 类型 | 实现 | 存储 | 用途 |
|---|---|---|---|
| **短期记忆**（ShortTermMemory） | Redis / 内存降级 | 会话内对话历史（K 轮） | Orchestrator 多轮对话 |
| **向量记忆**（UserVectorMemory） | RAG 服务 `/memory/user/*` | Qdrant | 用户历史问题语义检索 |
| **结构化记忆**（StructuredMemory） | 后端服务 API | 关系型数据库 | 知识点、难度等结构化学情 |

#### StateGraph

自研轻量状态机，参考 LangGraph 拓扑思路但不引入其依赖：
- 节点函数签名：`(state: Readonly<S>) => Promise<Partial<S>>`
- 状态合并：框架做 `Object.assign` 浅合并，规则完全透明
- 支持普通边（`addEdge`）和条件边（`addConditionalEdge`）
- 支持流式模式（`runStream`）逐节点推送事件

---

## 2. 项目结构

```text
apps/agent
├── src/index.ts                    # HTTP 入口（SSE 对话、健康检查、知识库接口）
├── src/container.ts                # 依赖注入容器（组装 LLM/Memory/Tools/Agents）
├── src/agents
│   ├── orchestrator/               # 意图识别与任务路由（Direct 推理）
│   │   ├── orchestrator.agent.ts
│   │   ├── orchestrator.prompts.ts
│   │   └── orchestrator.types.ts
│   ├── qa/                         # 核心问答（Graph：ocr→rag→generate→video）
│   │   ├── qa.agent.ts
│   │   ├── qa.graph.ts             # 节点函数定义
│   │   ├── qa.prompts.ts
│   │   └── qa.types.ts
│   ├── video/                      # Manim 视频生成（Graph：cache→脚本→渲染→上传）
│   │   ├── video.agent.ts
│   │   ├── video.graph.ts
│   │   ├── video.prompts.ts
│   │   └── video.types.ts
│   ├── learning-record/            # 知识点提取与学情报告（Direct，异步消费）
│   │   ├── learning-record.agent.ts
│   │   ├── learning-record.prompts.ts
│   │   └── learning-record.types.ts
│   └── knowledge-base/             # 文档入库/删除（Pipeline，无 LLM）
│       ├── knowledge-base.agent.ts
│       └── knowledge-base.types.ts
├── src/harness
│   ├── core
│   │   ├── agent.ts                # BaseAgent：tracing + callAgent + emit
│   │   ├── llm-client.ts           # ILLMClient + Anthropic/Doubao 实现 + 工厂
│   │   ├── graph.ts                # StateGraph / GraphRunner
│   │   ├── retry.ts                # 指数退避重试
│   │   └── types.ts                # 所有公共类型定义
│   ├── memory
│   │   ├── short-term.ts           # Redis / 内存短期记忆
│   │   ├── vector-memory.ts        # 用户向量记忆 + 内容向量缓存
│   │   └── db-memory.ts            # 结构化记忆（HTTP → 后端）
│   ├── rag-client
│   │   └── rag-client.ts           # RAG 服务 HTTP 封装（含 Redis 缓存）
│   ├── tool
│   │   ├── tool.ts                 # ToolDefinition 协议 + ToolRegistry
│   │   └── executor.ts             # ToolExecutor（LLM tool_use 调用分发）
│   ├── prompt
│   │   ├── builder.ts              # PromptBuilder（链式 API）
│   │   └── template.ts             # 模板变量替换
│   ├── output
│   │   └── schema-parser.ts        # 从 LLM 输出提取结构化 JSON
│   └── observer
│       ├── tracer.ts               # Span 观测（可接入 OpenTelemetry）
│       └── metrics.ts              # 延迟、token 用量指标
├── src/tools
│   ├── rag-retrieval.tool.ts       # 向量检索工具
│   ├── image-ocr.tool.ts           # 图片 OCR（调用 LLM Vision）
│   ├── file-parser.tool.ts         # 文件解析（调用 RAG /parse）
│   ├── manim-runner.tool.ts        # Manim 渲染工具
│   └── storage-upload.tool.ts      # 对象存储上传工具
├── src/events
│   └── event-bus.ts                # AgentEventBus（EventEmitter 封装）
├── src/constants
│   ├── models.ts                   # 模型标识常量（Anthropic + 豆包）
│   └── rules.ts                    # 业务规则常量
└── .env.example                    # 环境变量模板
```

---

## 3. 运行方式

### 前置依赖

- Node.js >= 20
- pnpm >= 9
- 可选：Redis（短期记忆；未配置时降级为进程内存）
- 依赖服务：
  - **RAG 服务**（默认 `http://localhost:8000`）—— 必须先启动
  - **后端服务**（默认 `http://localhost:3000`，用于结构化记忆持久化）

### 环境变量

```bash
cd apps/agent
cp .env.example .env
```

通过 `LLM_PROVIDER` 选择大模型 Provider：

| Provider | 必填 Key | 说明 |
|---|---|---|
| `anthropic`（默认） | `ANTHROPIC_API_KEY` | Claude 系列，支持 prompt cache、extended thinking |
| `doubao` | `DOUBAO_API_KEY` | 豆包（火山引擎方舟），使用 OpenAI 兼容接口 |

切换到豆包：

```bash
LLM_PROVIDER=doubao
DOUBAO_API_KEY=your-ark-api-key
# DOUBAO_BASE_URL 默认已填好（https://ark.cn-beijing.volces.com/api/v3）
```

其余必填：

```bash
RAG_SERVICE_URL=http://localhost:8000
SERVER_URL=http://localhost:3000
INTERNAL_TOKEN=your-internal-service-token
```

### 安装依赖

在仓库根目录执行（monorepo，统一管理）：

```bash
pnpm install
```

### 启动开发环境

```bash
# 方式一：monorepo 脚本（推荐）
pnpm dev:agent

# 方式二：直接启动
cd apps/agent && pnpm dev
```

默认监听：`http://localhost:8001`，代码变更自动重启（`tsx watch`）。

### 构建与生产运行

```bash
cd apps/agent
pnpm build       # tsc 编译到 dist/
pnpm start       # node dist/index.js
```

---

## 4. HTTP 接口

| Method | Path | 说明 |
|---|---|---|
| `GET` | `/health` | 健康检查 |
| `POST` | `/chat/stream` | SSE 流式对话（核心接口） |
| `GET` | `/analytics/:userId/report` | 获取用户学情报告 |
| `POST` | `/kb/upload` | 上传文档到知识库（管理员） |
| `DELETE` | `/kb/:knowledgeBaseId/:docId` | 删除知识库文档（管理员） |

**POST /chat/stream 请求体：**

```json
{
  "content": "质数定理怎么证明？",
  "subjectId": "math",
  "conversationId": "uuid-可选",
  "userId": "user-123",
  "imageBase64": "base64-可选",
  "imageMediaType": "image/jpeg"
}
```

**SSE 事件序列：**

```
data: {"type":"start","traceId":"..."}

data: {"type":"reply","content":"...","intent":"qa","videoUrl":null,"conversationId":"..."}

data: {"type":"done"}
```

---

## 5. 联调建议

- **启动顺序**：Qdrant / Redis → RAG 服务（`:8000`）→ 后端服务（`:3000`）→ Agent 服务（`:8001`）→ Web 前端
- **RAG 未启动**：Agent 会启动，但 QA 链路的 RAG 检索步骤会报错
- **Redis 未配置**：自动降级为内存短期记忆，服务重启后对话历史丢失
- **Manim / Storage 未配置**：视频生成功能自动跳过，QA 正常工作
- **切换 Provider 后**：需要同步修改 `src/constants/models.ts` 中 Agent 使用的模型 ID，指向豆包对应端点
