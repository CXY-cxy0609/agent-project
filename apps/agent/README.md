# Agent 服务（`@kaoyan/agent`）

基于 TypeScript + Express 的智能体编排服务，负责对外提供对话入口、路由用户意图、调用 RAG 与工具链，并串联多 Agent 协作流程。

## 1. 项目结构设计

```text
apps/agent
├── src/index.ts                    # HTTP 入口（SSE 对话、健康检查、知识库接口）
├── src/container.ts                # 依赖注入容器（组装 LLM/Memory/Tools/Agents）
├── src/agents
│   ├── orchestrator/               # 编排 Agent：意图识别与任务分发
│   ├── qa/                         # 问答 Agent：调用检索、生成回答
│   ├── video/                      # 视频内容相关 Agent
│   ├── learning-record/            # 学情记录 Agent（异步沉淀学习数据）
│   └── knowledge-base/             # 知识库管理 Agent（文档入库/删除）
├── src/harness
│   ├── core/                       # Agent 基类、LLM 客户端、重试与类型定义
│   ├── memory/                     # 短期记忆 + 向量记忆封装
│   ├── rag-client/                 # 对 RAG 服务的 HTTP 调用封装
│   ├── tool/                       # 工具协议与执行器
│   ├── prompt/                     # Prompt 模板与构造
│   └── observer/                   # Trace/指标观测
├── src/tools/                      # 工具实现（RAG 检索、OCR、文件解析、渲染、上传）
├── src/events/                     # 事件总线（QA 完成后异步触发学情记录）
├── src/constants/                  # 模型、规则等常量
└── .env.example                    # 环境变量模板
```

### 关键设计

- **分层清晰**：`index.ts` 只处理传输协议与 API，业务由 Agent/Tool 层承载。
- **可组合 Agent 架构**：`BaseAgent` 统一 tracing 和错误处理，具体执行逻辑由子 Agent 自由实现。
- **事件解耦**：通过事件总线异步写入学习记录，避免阻塞主对话链路。
- **外部能力可插拔**：RAG、Redis、Manim、存储上传均通过配置注入，未配置时可降级运行。

## 2. 运行方式

## 前置依赖

- Node.js >= 20
- pnpm >= 9
- 可选：Redis（短期记忆）
- 依赖服务：
  - RAG 服务（默认 `http://localhost:8000`）
  - 后端服务（默认 `http://localhost:3000`，用于结构化记忆）

## 环境变量

```bash
cd apps/agent
cp .env.example .env
```

至少建议配置：

- `ANTHROPIC_API_KEY`
- `RAG_SERVICE_URL`
- `SERVER_URL`
- `INTERNAL_TOKEN`

## 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

## 启动开发环境

方式一：从仓库根目录启动（推荐，走 monorepo 脚本）

```bash
pnpm dev:agent
```

方式二：在子项目目录直接启动

```bash
cd apps/agent
pnpm dev
```

默认监听端口：`8001`。

## 构建与生产运行

```bash
cd apps/agent
pnpm build
pnpm start
```

## 3. 常用接口

- `GET /health`：健康检查
- `POST /chat/stream`：SSE 流式对话
- `GET /analytics/:userId/report`：学情报告
- `POST /kb/upload`：知识库文档上传入库
- `DELETE /kb/:knowledgeBaseId/:docId`：知识库文档删除

## 4. 联调建议

- 本服务依赖 RAG 检索能力，建议先启动 `apps/rag`。
- 若未配置 Redis，会自动降级到内存短期记忆（仅进程生命周期有效）。
