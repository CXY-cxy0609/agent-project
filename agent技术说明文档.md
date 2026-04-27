# 技术说明文档

> 本文档从工程实现角度，对学习辅助平台的 Agent 系统进行完整技术方案说明。
> 
> **核心原则：完全自研框架（Harness），不引入 LangChain / LangGraph。**

---

## 一、自研框架设计：Harness

### 1.1 为什么不用 LangChain / LangGraph

| 维度 | LangChain / LangGraph 的问题 | Harness 的选择 |
|---|---|---|
| 依赖体积 | 安装体积庞大，间接依赖数百个包 | 零框架依赖，仅依赖 LLM SDK 和必要工具库 |
| 抽象层次 | LCEL、Runnable、RunnableSequence 等多层嵌套，调试困难 | 一切都是普通 TypeScript 类和函数，栈帧清晰 |
| 消息包装 | HumanMessage / AIMessage / SystemMessage 等包装类增加认知负担 | 使用原生 `{ role, content }` 结构，直接对应模型 API |
| 状态管理 | Annotation.Root 的 reducer 模式对新人不友好，合并逻辑隐晦 | 显式定义 State 接口，节点返回 `Partial<State>`，框架层做浅合并 |
| 版本碎片 | langchain-core / langchain-community / @langchain/anthropic 版本经常不兼容 | 直接调用 `@anthropic-ai/sdk`，版本完全可控 |
| 可扩展性 | 扩展核心行为需要继承特定基类，耦合深 | 基于接口（Interface）和组合，不强制继承 |

**保留 LangGraph 的优秀理念：**
- 图（Graph）驱动的 Agent 工作流，节点（Node）+ 边（Edge）的声明式定义
- 状态（State）在节点间流转，整体流程可视化、可追踪
- 条件边（Conditional Edge）支持动态路由
- 检查点（Checkpoint）支持中断与恢复

---

### 1.2 Harness 核心模块

```
harness/
├── core/
│   ├── llm-client.ts       # LLM 调用薄包装（流式/非流式）
│   ├── graph.ts            # 轻量状态机（StateGraph）
│   ├── agent.ts            # Agent 基类
│   └── types.ts            # 全局类型定义
├── tool/
│   ├── tool.ts             # Tool 抽象与注册
│   └── executor.ts         # Function Calling 执行引擎（含 maxSteps 保护）
├── prompt/
│   ├── template.ts         # Prompt 模板引擎
│   └── builder.ts          # 分层 Prompt 构建器（含 cache_control 标记）
├── memory/
│   ├── short-term.ts       # 短期记忆（上下文窗口）
│   ├── vector-memory.ts    # 向量语义记忆
│   └── db-memory.ts        # 结构化 DB 记忆
├── rag-client/             # ⚠️ 注意：这里只是 HTTP 适配器，不包含 RAG 逻辑
│   └── rag-client.ts       # 封装对 apps/rag（Python FastAPI）的 HTTP 调用
│                           # RAG 的检索/Rerank/上下文构建逻辑全在 apps/rag/ 中实现
├── output/
│   └── schema-parser.ts    # YAML Schema 结构化输出解析
├── observer/
│   ├── tracer.ts           # 链路追踪（OpenTelemetry）
│   └── metrics.ts          # 指标采集
└── eval/
    └── evaluator.ts        # 自动测评
```

> **架构边界说明：** Harness 是纯 TypeScript 框架，运行在 Node.js 进程里。RAG 的核心能力（向量检索、Rerank、Chunk 处理）由独立的 Python 服务 `apps/rag` 提供，两者通过 HTTP 通信。`harness/rag-client/` 只是这个 HTTP 调用的类型化封装，**不在 TS 层重复实现检索逻辑**。

---

### 1.3 核心模块详细设计

#### 1.3.1 LLMClient（LLM 调用薄包装）

**设计原则：** 只做三件事——调用 API、处理流式输出、统一错误。绝不封装 Message 类型。

```typescript
// harness/core/types.ts
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];   // 支持多模态（文字 + 图片 base64）
}

// 多模态内容块（图片上传场景）
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; mediaType: string; data: string } };

export interface LLMCallOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];          // Function Calling
  cacheBreakpoint?: number;          // 在第 N 条 message 后插入 cache_control（见第九章）
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: { promptTokens: number; completionTokens: number; cacheReadTokens?: number };
  model: string;
  latencyMs: number;
}

// 流式 chunk（token 级粒度）
export interface StreamChunk {
  type: 'text_delta' | 'tool_call_delta' | 'done';
  delta?: string;
  finalResponse?: LLMResponse;   // type === 'done' 时附带完整响应（含 usage）
}
```

```typescript
// harness/core/llm-client.ts
export class LLMClient {
  // 非流式：等待完整响应
  async call(options: LLMCallOptions): Promise<LLMResponse>

  // 流式：返回 AsyncGenerator，调用方 for-await 逐 chunk 消费
  // 相比回调方式，调用方可以用标准 for-await-of，中途 break 即可取消
  async *stream(options: LLMCallOptions): AsyncGenerator<StreamChunk>

  // 内部：自动重试（含 exponential backoff）
  private async callWithRetry(options: LLMCallOptions, attempt: number): Promise<LLMResponse>
}
```

**为什么用 AsyncGenerator 而非 `onChunk` 回调：**
- 回调方式将副作用混入 `LLMCallOptions`，每次调用都要传 `onChunk`，破坏了配置对象的纯粹性
- AsyncGenerator 是标准 JavaScript 异步迭代协议，调用方用 `for await...of` 消费，逻辑清晰；中途取消直接 `break`，无需额外清理
- 便于在 `GraphRunner.runStream()` 中向上透传 token 级流式输出（而非只有节点完成事件）

**成本优化接入点：** `LLMClient` 内置 usage 统计，每次调用记录 token 消耗（含 cache hit tokens），供 Observer 采集。

---

#### 1.3.2 StateGraph（轻量状态机）

**设计原则：** 抄 LangGraph 的图拓扑思路，但去掉 Annotation / Reducer 魔法，用显式接口替代。

```typescript
// harness/core/graph.ts

export type NodeFn<S> = (state: Readonly<S>) => Promise<Partial<S>>;

// ConditionFn 返回的路由键必须是 routes 参数里声明的 key，
// 用泛型约束替代裸字符串，编译期就能发现拼写错误
export type ConditionFn<S, Routes extends string> = (state: Readonly<S>) => Routes;

export const END = '__end__' as const;

export class StateGraph<S extends object> {
  constructor(private initialState: S) {}

  addNode(name: string, fn: NodeFn<S>): this
  addEdge(from: string, to: string | typeof END): this

  // Routes 泛型约束：condition 的返回值必须是 routeMap 的 key 之一
  addConditionalEdge<Routes extends string>(
    from: string,
    condition: ConditionFn<S, Routes>,
    routeMap: Record<Routes, string | typeof END>
  ): this

  compile(): GraphRunner<S>
}

export class GraphRunner<S> {
  // 非流式：返回最终状态
  async run(input: Partial<S>): Promise<S>

  // 流式：返回 AsyncGenerator，区分两个粒度的事件
  // - 节点级：每个节点完成时推送（用于"思考链"进度展示）
  // - token 级：LLM 生成时逐 token 推送（用于流式输出到前端）
  async *runStream(input: Partial<S>): AsyncGenerator<GraphStreamEvent<S>>
}

export type GraphStreamEvent<S> =
  | { type: 'node_start'; node: string }
  | { type: 'node_done'; node: string; delta: Partial<S> }
  | { type: 'token'; node: string; token: string }      // LLM 生成 token
  | { type: 'graph_done'; finalState: S };
```

**状态合并规则（透明，无魔法）：** 每个节点返回 `Partial<S>`，框架做 `Object.assign(state, delta)` 浅合并。数组追加由节点自己负责：`return { items: [...state.items, newItem] }`——不引入 LangGraph 的 Reducer 魔法，合并行为完全透明可预期。

---

#### 1.3.3 Agent 基类

**LangChain 的继承陷阱：** LangChain 要求继承 `BaseTool`、`BaseChain`、`BaseRetriever` 等基类，导致业务逻辑与框架深度耦合，难以独立测试。Harness 的 `BaseAgent` 只提供三件事：上下文透传、可观测性钩子、子 Agent 调用辅助——核心执行逻辑由子类自由实现，**不强制使用 Graph**。

```typescript
// harness/core/agent.ts

export interface AgentContext {
  userId: string;
  sessionId: string;
  traceId: string;     // 链路追踪 ID，在整个调用链中透传
  metadata?: Record<string, unknown>;
}

// 记忆接口拆分（接口隔离原则）——不同 Agent 只注入它实际需要的部分
export interface ShortTermMemory {
  getHistory(sessionId: string): Promise<Message[]>;
  appendHistory(sessionId: string, messages: Message[]): Promise<void>;
}

// 用户级向量记忆：以 userId 为 scope，记录该用户的历史问答
// 用途：QA Agent 召回用户以前问过的相似问题，增强个性化感
export interface UserVectorMemory {
  search(query: string, userId: string, topK: number): Promise<string[]>;
  store(userId: string, content: string): Promise<void>;
}

// 内容级向量缓存：全局共享，不区分用户，以内容语义为 key
// 用途：Video Agent 查询"语义相似的知识点是否已有渲染好的视频"
// 与用户无关，同一知识点的视频对所有用户复用
export interface ContentVectorCache {
  search(query: string, topK: number): Promise<CachedContent[]>;
  store(content: string, payload: CachedContent): Promise<void>;
}

export interface CachedContent {
  contentKey: string;    // 知识点标准化描述（作为语义 key）
  payload: unknown;      // 缓存的数据，Video Agent 存 { videoUrl, subject, createdAt }
  score?: number;        // 检索时的相似度分
}

export interface StructuredMemory {
  write(record: LearningRecord): Promise<void>;
  query(userId: string, filters: MemoryFilter): Promise<LearningRecord[]>;
}

// BaseAgent：只提供钩子和辅助，不强制任何执行模式
export abstract class BaseAgent<TInput, TOutput> {
  constructor(
    protected llm: LLMClient,
    protected observer: Observer,
    // 各子类按需注入所需记忆层，不注入整个 MemorySystem
  ) {}

  // 唯一必须实现的方法：执行逻辑
  // 子类可以自由选择：单次 LLM call / Graph / 自定义循环
  abstract execute(input: TInput, ctx: AgentContext): Promise<TOutput>;

  // 框架层 run()：在 execute() 外自动包裹 tracing、metrics、错误处理
  async run(input: TInput, ctx: AgentContext): Promise<TOutput> {
    // 框架负责：开启 span、记录延迟/token、捕获异常上报
    // 业务逻辑全在 execute() 里，BaseAgent 不感知
  }

  // 辅助：同步调用子 Agent（自动传递 traceId）
  protected async callAgent<I, O>(agent: BaseAgent<I, O>, input: I, ctx: AgentContext): Promise<O>

  // 辅助：异步事件派发（fire-and-forget，不阻塞主链路）
  protected emit(event: string, payload: unknown): void
}
```

**不同 Agent 的执行模式举例：**

```typescript
// Orchestrator Agent：单次 LLM call（Direct 模式），不需要 Graph
class OrchestratorAgent extends BaseAgent<OrchestratorInput, OrchestratorOutput> {
  async execute(input, ctx) {
    const intent = await this.llm.call({ ... });  // 直接调用，无需 Graph
    return { intent };
  }
}

// QA Agent：用 Graph 编排多步骤（RAG → 推理 → 可选视频）
class QAAgent extends BaseAgent<QAInput, QAOutput> {
  private graph = new StateGraph<QAState>({ ... })
    .addNode('rag', this.ragNode.bind(this))
    .addNode('generate', this.generateNode.bind(this))
    .addConditionalEdge('generate', this.shouldGenerateVideo, { yes: 'video', no: END })
    .compile();

  async execute(input, ctx) {
    return this.graph.run(input);
  }
}
```

---

#### 1.3.4 Tool（工具系统）

**设计原则：** Tool 就是一个带有 JSON Schema 描述的异步函数，没有更多。

```typescript
// harness/tool/tool.ts

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;   // 标准 JSON Schema，送给 LLM 的 tools 参数
}

export interface Tool<TInput, TOutput> extends ToolDefinition {
  execute(input: TInput): Promise<TOutput>;
}

// 注册与查找
export class ToolRegistry {
  register(tool: Tool<unknown, unknown>): void
  get(name: string): Tool<unknown, unknown> | undefined
  toDefinitions(): ToolDefinition[]   // 序列化成 LLM API 需要的格式
}
```

```typescript
// harness/tool/executor.ts

export interface AgenticLoopOptions {
  maxSteps?: number;       // 默认 10，超出后强制终止并抛出 MaxStepsExceededError
                           // LangGraph 同样有此问题：不设上限的 agent loop 遇到 LLM 反复
                           // 调用工具时会无限运行，这是 agentic 系统最常见的稳定性漏洞
  onStep?: (step: AgenticStep) => void;  // 每步完成后的观测钩子
}

export interface AgenticStep {
  stepIndex: number;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  assistantMessage: string;
}

export class ToolExecutor {
  constructor(private registry: ToolRegistry) {}

  // 单次执行：LLM 返回 tool_calls → 并发执行 → 返回 tool results
  async execute(toolCalls: ToolCall[]): Promise<ToolResult[]>

  // Agentic Loop：自动循环直到 LLM 停止调用工具或达到 maxSteps
  async agenticLoop(
    messages: Message[],
    options: LLMCallOptions,
    loopOptions?: AgenticLoopOptions,
  ): Promise<{ finalContent: string; steps: AgenticStep[]; stoppedBy: 'llm' | 'maxSteps' }>
}
```

---

## 二、Prompt 工程

### 2.1 四层结构

每个 Prompt 由四层组成，层层叠加，互不耦合：

```
┌─────────────────────────────────────────┐
│  Layer 4: 输出要求（Output Format）      │  ← 结构化输出约束、Schema
├─────────────────────────────────────────┤
│  Layer 3: 上下文信息（Context）          │  ← RAG 召回内容、对话历史摘要
├─────────────────────────────────────────┤
│  Layer 2: 任务描述（Task）              │  ← 当前具体任务说明、用户输入
├─────────────────────────────────────────┤
│  Layer 1: 角色定义（Persona）            │  ← Agent 身份、能力范围、规则层
└─────────────────────────────────────────┘
```

### 2.2 模板引擎

使用轻量的 Mustache 风格模板，避免引入模板框架依赖：

```typescript
// harness/prompt/template.ts

export interface PromptTemplate {
  name: string;
  template: string;    // 支持 {{variable}} 插值
  requiredVars: string[];
  optionalVars?: Record<string, string>;  // 可选变量的默认值
}

export class PromptRenderer {
  render(template: PromptTemplate, vars: Record<string, string>): string
}
```

### 2.3 分层 Prompt 构建器

```typescript
// harness/prompt/builder.ts

export class PromptBuilder {
  setPersona(template: PromptTemplate, vars: Record<string, string>): this
  setTask(template: PromptTemplate, vars: Record<string, string>): this
  setContext(context: string): this                        // RAG 内容直接注入
  setOutputFormat(schema: OutputSchema): this             // 输出格式约束
  build(): Message[]                                      // 返回 messages 数组
}
```

**示例（QA Agent 的 system prompt 构建）：**

```typescript
const messages = new PromptBuilder()
  .setPersona(PERSONA_TEMPLATES.tutor, { subject: '高等数学' })
  .setContext(ragContext)
  .setTask(TASK_TEMPLATES.qa, { question: userInput })
  .setOutputFormat(QA_OUTPUT_SCHEMA)
  .build();
```

---

## 三、结构化输出

### 3.1 为什么用 YAML 而非 JSON

- LLM 输出 JSON 时容易在字符串内容中出现未转义引号、换行符，导致 `JSON.parse` 报错
- YAML 对人类友好，LLM 生成 YAML 的语法错误率更低
- YAML 支持多行字符串（`|`），适合存放 LaTeX 公式、代码块等内容

### 3.2 Schema 约束设计

```typescript
// harness/output/schema-parser.ts

export interface OutputSchema {
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description: string;
    enum?: string[];
  }>;
}

export class SchemaParser {
  // 将 Schema 序列化成注入 Prompt 的说明文字
  toPromptInstruction(schema: OutputSchema): string

  // 解析 LLM 输出的 YAML 字符串，验证 Schema 合规性
  parse<T>(yamlString: string, schema: OutputSchema): T

  // 从 LLM 原始输出中提取 YAML 块（处理 LLM 可能加的 ```yaml 代码块）
  extractYaml(rawOutput: string): string
}
```

**示例（QA Agent 的输出 Schema）：**

```yaml
# LLM 须按此格式输出
answer: |
  这是解答内容，支持 LaTeX 公式如 $E=mc^2$
knowledge_points:
  - 导数的定义
  - 极限的计算
needs_video: false
difficulty: medium   # easy | medium | hard
subject: 高等数学
```

---

## 四、RAG 系统

### 4.1 整体 Pipeline

```
用户 Query
    │
    ▼
① Query 预处理
  ├─ 科目识别（从 Query 中推断所属科目，缩小检索范围）
  └─ Query 扩展（HyDE：生成假设性答案，提升检索召回率）
    │
    ▼
② 向量检索
  ├─ Query 向量化（Embedding Model）
  └─ ANN 检索（向量数据库，返回 Top-K 候选片段）
    │
    ▼
③ Rerank
  └─ 使用 Cross-Encoder 对 Top-K 结果重排序，提升精度
    │
    ▼
④ 上下文压缩
  └─ 对 Rerank 后的片段做摘要压缩，控制 token 总量
    │
    ▼
⑤ 上下文构建
  └─ 拼接片段 + Metadata（来源文档、章节、页码），注入 Prompt
```

### 4.2 Multi-Source RAG

系统存在两种数据源，需统一检索接口：

| 来源 | 内容 | 检索方式 |
|---|---|---|
| 文档知识库 | 教材、笔记、题库（PDF/MD） | 向量相似度检索 |
| 数据库数据 | 用户学情记录、错题记录 | 结构化 SQL 查询 |

```typescript
// harness/rag/retriever.ts

export interface RetrievedChunk {
  content: string;
  source: 'document' | 'database';
  metadata: {
    subject: string;
    documentPath?: string;
    chapter?: string;
    pageNumber?: number;
    score: number;
  };
}

export interface Retriever {
  retrieve(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]>
}

// 多源检索器：并发检索多个源，合并后统一 Rerank
export class MultiSourceRetriever implements Retriever {
  constructor(private sources: Retriever[]) {}
  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]>
}
```

### 4.3 文档解析 Pipeline

```
原始文档（MD / PDF文字 / PDF图片）
    │
    ▼
① 文档类型识别
    ├─ .md → Markdown 解析器（按标题层级分段）
    ├─ .pdf（文字型） → PDF 文本提取（pdfjs / poppler）
    └─ .pdf（图片型） → OCR（Tesseract / 第三方 OCR API）
    │
    ▼
② 结构化解析
  └─ 提取标题层级、正文段落、表格、代码块、公式块
    │
    ▼
③ Chunk 切分策略
  ├─ 优先按标题/章节边界切分（语义完整性优先）
  ├─ 超出 maxChunkSize（512 tokens）时滑动窗口切分，保留 10% 重叠
  └─ 过短的 Chunk（< 50 tokens）与相邻 Chunk 合并
    │
    ▼
④ Metadata 标注
  └─ { subject, documentPath, chapterTitle, pageNumber, chunkIndex, tokenCount }
    │
    ▼
⑤ 向量化 → 写入向量数据库
```

### 4.4 向量数据库选型建议

- **推荐：Qdrant**（支持 payload filter，可按科目过滤，性能好，部署简单）
- Embedding Model：优先使用 `text-embedding-3-small`（成本低）或本地部署的 BGE-M3（中文效果更好）

---

## 五、记忆系统

### 5.1 三层记忆架构

```
┌───────────────────────────────────────────────────┐
│               记忆系统（MemorySystem）             │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  短期记忆     │  │  向量记忆     │  │  DB记忆  │ │
│  │ (上下文窗口)  │  │ (语义检索)    │  │ (结构化) │ │
│  │              │  │              │  │          │ │
│  │ 存储介质：   │  │ 存储介质：   │  │ 存储介质:│ │
│  │ 内存/Redis   │  │ 向量数据库   │  │ PostgreSQL│ │
│  │              │  │              │  │          │ │
│  │ 生命周期：   │  │ 生命周期：   │  │ 生命周期:│ │
│  │ 单次会话     │  │ 跨会话持久   │  │ 永久持久 │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
└───────────────────────────────────────────────────┘
```

### 5.2 短期记忆

**作用：** 维护当前会话的多轮上下文，供 LLM 感知对话历史。

**策略：**
- 窗口大小：保留最近 N 轮（默认 10 轮），超出时按 FIFO 淘汰
- 超长对话摘要压缩：当 token 累积超过阈值时，对最早的若干轮做摘要，以摘要替换原始内容
- 存储：Redis（支持多副本、TTL 自动过期）

### 5.3 向量记忆

向量记忆按用途分两种，底层都是向量数据库（Qdrant），但 Collection 和 scope 不同：

**① 用户级向量记忆（`UserVectorMemory`）**

- **用途：** QA Agent 召回该用户历史问答，增强个性化感（"你上周也问过类似的问题"）
- **Scope：** 按 `userId` 隔离，用户 A 的记忆不会干扰用户 B
- **写入时机：** 每次 QA 完成后异步写入（问题 + 回答摘要）
- **检索时机：** 每次 QA 开始前，用当前问题检索相似历史

**② 内容级向量缓存（`ContentVectorCache`）**

- **用途：** Video Agent 在生成视频前，先用知识点描述做语义检索，命中相似内容则直接返回已有视频 URL，跳过整个生成流水线（避免对相同/相近知识点重复渲染，节省大量计算成本）
- **Scope：** 全局共享，不区分用户，所有用户对相同知识点复用同一个视频
- **写入时机：** Manim 渲染成功并上传后异步写入（存 `videoUrl`、`subject`、`createdAt`）
- **检索时机：** Video Agent 的 Graph 第一个节点（在分镜脚本生成之前）
- **参数控制：** Video Agent 的输入参数中包含 `useVideoCache: boolean`（默认 `true`），可按需关闭（例如知识点有更新、需要强制重新生成时传 `false`）
- **相似度阈值：** 检索命中后需判断 `score >= threshold`（默认 0.92），低于阈值不算命中、继续生成——避免"极限的定义"和"导数的定义"被错误复用

```typescript
// Video Agent 入口参数示例
export interface VideoAgentInput {
  knowledgeDescription: string;  // 知识点描述，作为向量检索的 query
  subject: string;
  useVideoCache?: boolean;        // 默认 true；传 false 强制重新渲染
  cacheScoreThreshold?: number;  // 默认 0.92
}

// Video Agent Graph 的第一个节点：cache lookup
async function checkVideoCache(state: VideoState): Promise<Partial<VideoState>> {
  if (!state.useVideoCache) return { cacheHit: false };

  const hits = await contentVectorCache.search(state.knowledgeDescription, 1);
  const top = hits[0];
  if (top && top.score >= state.cacheScoreThreshold) {
    return { cacheHit: true, videoUrl: (top.payload as any).videoUrl };
  }
  return { cacheHit: false };
}

// Graph 结构：命中缓存则直接走 return_cached 节点，跳过整个生成流水线
graph
  .addNode('checkCache', checkVideoCache)
  .addNode('generateStoryboard', ...)
  .addNode('generateScript', ...)
  .addNode('renderManim', ...)
  .addNode('returnCached', (s) => ({ videoUrl: s.videoUrl }))
  .addConditionalEdge('checkCache', (s) => s.cacheHit ? 'hit' : 'miss', {
    hit: 'returnCached',
    miss: 'generateStoryboard',
  })
```

### 5.4 DB 记忆（结构化长期记忆）

**作用：** 学情记录的持久化存储，支持复杂查询（按科目、时间、频次统计）。

```sql
-- 核心数据表
CREATE TABLE learning_records (
  id          BIGSERIAL PRIMARY KEY,
  user_id     VARCHAR(64) NOT NULL,
  session_id  VARCHAR(64) NOT NULL,
  subject     VARCHAR(32) NOT NULL,
  chapter     VARCHAR(128),
  knowledge_point VARCHAR(256) NOT NULL,
  difficulty  VARCHAR(8),   -- easy | medium | hard
  asked_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lr_user_subject ON learning_records(user_id, subject);
```

---

## 六、Agent 本身设计

### 6.1 推理模式

根据任务类型动态选择推理模式，平衡质量与成本：

| 模式 | 适用场景 | 实现方式 | 成本 |
|---|---|---|---|
| **Direct** | 简单问答、意图分类 | 单次 LLM 调用 | 低 |
| **ReAct** | 需要工具调用的 Q&A | Thought → Action → Observation 循环 | 中 |
| **Plan-and-Execute** | 视频生成等多步任务 | 先生成全局计划，再逐步执行 | 中高 |
| **Extended Thinking** | 复杂数学推导、证明题 | 启用模型 extended thinking 功能 | 高 |

推理模式在各 Agent 的 Prompt Layer 1（角色定义）中声明，Graph 结构体现执行方式。

### 6.2 规则层

规则层在 Persona 层之后、Task 层之前注入，作为 Hard Constraint：

```typescript
// 规则分为两类：
// 1. 全局规则（所有 Agent 共用）
const GLOBAL_RULES = [
  '只回答与所支持科目相关的问题，拒绝与学习无关的请求',
  '不得生成政治敏感、违法或有害内容',
  '回答中的数学公式必须使用 LaTeX 格式，单行公式用 $...$，多行用 $$...$$',
];

// 2. Agent 级规则（各 Agent 专属）
const QA_AGENT_RULES = [
  '若知识库检索结果与问题相关度低，须明确说明参考内容有限',
  '解题步骤须逐步展示，不得直接给出答案而省略推导过程',
];
```

### 6.3 Skill 设计原则

Skill 是比 Tool 更高层的可复用推理单元（Tool 是外部调用，Skill 是 LLM 推理能力的封装）：

- **单一职责**：一个 Skill 只做一件事（例：`extract_knowledge_points`、`generate_storyboard`）
- **高内聚低耦合**：Skill 的输入输出均为结构化 Schema，不依赖外部状态
- **描述清晰**：description 须精准描述使用场景，避免 LLM Tool Selection 歧义
- **可组合**：Skill 可作为其他 Skill 或 Agent 的输入

---

## 七、反馈与验证机制 / 重试机制

### 7.1 通用重试策略

```typescript
// harness/core/retry.ts

export interface RetryOptions {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  initialDelayMs: number;
  retryOn: (error: Error) => boolean;  // 判断是否值得重试
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T>
```

### 7.2 各场景重试策略

| 场景 | 最大次数 | 退避策略 | 重试条件 |
|---|---|---|---|
| LLM API 调用失败 | 3 | 指数退避（1s/2s/4s） | 429 限流、5xx 服务端错误 |
| Manim 脚本执行报错 | 3 | 无延迟（立即修正脚本） | 任何 Python 运行时错误 |
| 结构化输出解析失败 | 2 | 无延迟（重新调用 LLM） | YAML 格式错误、Schema 不符 |
| RAG 检索超时 | 2 | 固定 500ms | 网络超时 |

### 7.3 Manim 重试的修正机制

Video Agent 中，Manim 执行失败时不是简单重试原脚本，而是将错误信息作为新上下文让 LLM 修正：

```
第 1 次执行失败
    │
    ▼
将 [原始脚本 + 错误信息] 作为 Prompt 上下文
让 LLM 分析错误原因并修正脚本
    │
    ▼
执行修正后的脚本（第 2 次）
    │
    ▼（仍失败）
再次修正（第 3 次）
    │
    ▼（仍失败）
返回失败状态 + 错误摘要给调用方
```

### 7.4 结构化输出验证

每次 LLM 输出后，`SchemaParser` 做两层验证：
1. **格式验证**：YAML 是否可解析
2. **Schema 验证**：必填字段是否存在、类型是否正确

验证失败时，将原始输出和验证错误作为上下文，追加一条 `user` 消息要求 LLM 修正，最多重试 2 次。

---

## 八、可观测性

### 8.1 链路追踪

每次用户请求生成唯一 `traceId`，在整个 Agent 调用链路中透传：

```
traceId: abc-123
    ├─ span: orchestrator.run          [0ms - 1500ms]
    │    ├─ span: intent_classify      [0ms - 80ms]
    │    └─ span: qa_agent.run         [80ms - 1500ms]
    │         ├─ span: rag_retrieval   [80ms - 350ms]
    │         ├─ span: llm_call        [350ms - 1400ms]
    │         │    └─ tokens: { prompt: 1200, completion: 400 }
    │         └─ span: learning_record [async, 1400ms+]
    └─ total_latency: 1500ms
```

使用 OpenTelemetry 标准 SDK，兼容 Jaeger / Grafana Tempo 等后端，**不依赖 LangSmith**。

### 8.2 日志规范

```typescript
// 结构化日志，JSON 格式，每条日志包含：
{
  timestamp: string,
  level: 'debug' | 'info' | 'warn' | 'error',
  traceId: string,
  agentName: string,
  nodeName: string,
  message: string,
  data?: Record<string, unknown>
}
```

### 8.3 关键指标采集

| 指标 | 说明 | 告警阈值 |
|---|---|---|
| `agent.latency_ms` | 各 Agent 端到端耗时 | P99 > 5000ms |
| `llm.token_usage` | 每次 LLM 调用的 token 消耗 | 单次 > 8000 tokens |
| `llm.error_rate` | LLM 调用失败率 | > 1% |
| `rag.recall_score` | RAG 召回相关性评分（均值） | < 0.6 |
| `output.parse_failure_rate` | 结构化输出解析失败率 | > 5% |
| `video.render_success_rate` | Manim 渲染成功率 | < 90% |

---

## 九、成本控制

### 9.1 Token 优化

- **Prompt 压缩**：RAG 上下文在注入前先做摘要压缩，控制单次调用 prompt token ≤ 4000
- **短期记忆摘要**：多轮对话超过窗口时，对历史消息做摘要，压缩上下文长度

### 9.2 小模型策略

| 任务类型 | 推荐模型 | 原因 |
|---|---|---|
| 意图分类（Orchestrator） | `claude-haiku` | 简单分类任务，速度快、成本极低 |
| 知识点提取（Learning Record） | `claude-haiku` | 结构化提取，不需要强推理 |
| 学情报告生成 | `claude-haiku` | 模板化文字生成 |
| 核心问答（QA Agent） | `claude-sonnet` | 需要高质量推理 |
| 复杂数学推导 | `claude-sonnet`（extended thinking） | 需要深度推理 |
| 视频脚本生成 | `claude-sonnet` | 创意性 + 准确性要求高 |

### 9.3 缓存策略

**Prompt Cache（Anthropic API）**

Anthropic 的 prompt cache 通过在 message 内容中添加 `cache_control: { type: "ephemeral" }` 标记实现。规则是：标记点之前的所有 token 被缓存，命中后这部分 token 以约 1/10 的价格计费。

`PromptBuilder` 在 `build()` 时负责自动插入 cache breakpoint，调用方无需感知细节：

```typescript
// harness/prompt/builder.ts

export class PromptBuilder {
  setPersona(template: PromptTemplate, vars: Record<string, string>): this
  setTask(template: PromptTemplate, vars: Record<string, string>): this
  setContext(context: string): this
  setOutputFormat(schema: OutputSchema): this

  build(): { messages: Message[]; cacheBreakpoint: number } {
    // 返回 messages 数组，同时告知 LLMClient 在第几条 message 后插入 cache_control
    // Layer 1（Persona）+ Layer 2 规则层 = 静态内容 → 设为 cache breakpoint
    // Layer 3（Context/RAG）+ Layer 4（Task/用户输入）= 动态内容 → 不缓存
    //
    // 实际 API 调用时，LLMClient 在 cacheBreakpoint 位置的 content 末尾
    // 加上 { cache_control: { type: "ephemeral" } }，对 Anthropic SDK 透明
  }
}
```

**缓存命中条件：** Persona + 规则层的内容完全一致时命中。由于同一 Agent 的 Persona 是固定模板，同一用户在同一 session 内的连续请求几乎 100% 命中。

| 缓存类型 | 实现位置 | 缓存 Key | TTL |
|---|---|---|---|
| Prompt Cache | Anthropic API 侧（自动） | Persona + 规则层内容的 hash | 5 分钟（API 默认） |
| RAG 检索缓存 | Redis（`rag-client`） | `md5(query + subjectId)` | 5 分钟 |
| Embedding 缓存 | Redis（`apps/rag`） | `md5(text)` | 永久 |

---

## 十、稳定性设计

### 10.1 安全防护

- **输入净化**：对用户输入做长度截断（maxLength = 2000 chars）、敏感词过滤
- **Prompt Injection 防护**：系统 Prompt 与用户输入在消息结构层面严格隔离（不做字符串拼接），用户输入始终作为 `role: user` 的独立消息
- **输出内容过滤**：在返回给前端前，对 LLM 输出做安全检测

### 10.2 降级策略

| 故障场景 | 降级方案 |
|---|---|
| 向量数据库不可用 | 跳过 RAG 检索，直接用 LLM 内置知识回答，并告知用户 |
| Manim 渲染服务不可用 | 跳过视频生成，只返回文字解答 |
| LLM API 限流 | 切换备用模型（如 claude-haiku 降级），或返回"系统繁忙"提示 |
| OCR 服务不可用 | 告知用户图片暂时无法识别，请转为文字描述 |

---

## 十一、Multi-Agent 架构设计

### 11.1 通信模型

```typescript
// 同步调用（子 Agent）
const result = await agent.run(input, ctx);

// 异步事件（后台 Agent）
eventBus.emit('qa.completed', {
  traceId, userId, sessionId,
  question, answer, knowledgePoints
});
// Learning Record Agent 订阅此事件，不阻塞主链路
```

### 11.2 协作模式总结

| 协作模式 | 应用场景 | 实现方式 |
|---|---|---|
| **层级调用**（Hierarchical） | Orchestrator → QA → Video | 同步子任务调用 |
| **管道**（Pipeline） | Knowledge Base Agent 文档处理流 | Graph 串行节点 |
| **异步事件**（Event-Driven） | QA → Learning Record | EventBus 订阅 |
| **并行扇出**（Fan-Out） | 未来扩展：多科目并行检索 | `Promise.all` 并发调用 |

---

## 十二、Agent 自动测评

### 12.1 测评维度

```typescript
export interface EvalResult {
  agentName: string;
  testCaseId: string;
  success: boolean;         // 任务是否成功完成
  latencyMs: number;        // 端到端耗时
  cost: {
    promptTokens: number;
    completionTokens: number;
    estimatedUsdCost: number;
  };
  score: number;            // 综合分（0-100）
}
```

### 12.2 综合评分公式

```
score = success_weight × success_score
      + latency_weight × latency_score
      + cost_weight    × cost_score

其中：
  success_score = success ? 100 : 0
  latency_score = max(0, 100 - (latencyMs - baseline_ms) / baseline_ms × 100)
  cost_score    = max(0, 100 - (actualCost - baseline_cost) / baseline_cost × 100)

  默认权重：success_weight=0.6, latency_weight=0.2, cost_weight=0.2
```

### 12.3 测评数据集设计

每个 Agent 维护独立的测试用例集，存储在 `apps/agent/eval/` 目录下：

```
eval/
├── qa-agent/
│   ├── cases.yaml          # 测试用例（问题 + 期望知识点标签 + 期望输出格式）
│   └── golden.yaml         # 参考答案（用于相似度打分）
├── video-agent/
│   └── cases.yaml          # 测试用例（知识点描述 + 期望脚本结构）
└── learning-record-agent/
    └── cases.yaml          # 测试用例（对话摘要 + 期望提取的知识点）
```

### 12.4 评测运行方式

```bash
# 单 Agent 评测
pnpm eval --agent qa-agent --cases eval/qa-agent/cases.yaml

# 全量评测 + 生成报告
pnpm eval --all --report eval-report.html
```

---

## 附录：技术选型汇总

| 模块 | 选型 | 说明 |
|---|---|---|
| LLM | Anthropic Claude（Sonnet / Haiku） | 核心推理模型 |
| Embedding | text-embedding-3-small / BGE-M3 | 向量化，中文优先 BGE |
| 向量数据库 | Qdrant | 支持 payload filter，部署简单 |
| 关系型数据库 | PostgreSQL | 学情记录、用户数据 |
| 缓存 | Redis | 短期记忆、RAG 检索缓存 |
| OCR | Tesseract（本地）/ 第三方 API | 图片型 PDF 处理 |
| 链路追踪 | OpenTelemetry + Jaeger | 不依赖 LangSmith |
| 视频渲染 | Manim Community Edition | 数学动画渲染 |
| 对象存储 | S3 兼容（MinIO 自部署 / 云 OSS） | 视频文件存储 |
| 运行时 | Node.js + TypeScript | 与现有项目栈一致 |
