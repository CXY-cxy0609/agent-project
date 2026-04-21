# 研智辅导 · 考研智能辅导平台

基于大模型 AI 的考研智能辅导平台，聚焦知识点讲解、智能答题、学情分析三大核心场景。

## 项目结构

```
agent-project/
├── apps/
│   ├── web/          # Vue3 + Ant Design Vue + Ant Design X Vue（前端）
│   ├── server/       # NestJS（后端 API 服务）
│   ├── agent/        # LangGraph TypeScript（AI Agent 服务）
│   └── rag/          # Python FastAPI（RAG 知识库服务，与后端解耦）
├── packages/
│   └── shared/       # 跨服务共享 TypeScript 类型定义
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## 技术栈

| 子项目 | 技术栈 |
|--------|--------|
| `apps/web` | Vue3 + Vite + Ant Design Vue + Ant Design X Vue + Pinia |
| `apps/server` | NestJS + TypeORM + MySQL + Redis |
| `apps/agent` | LangGraph TypeScript + Claude API |
| `apps/rag` | FastAPI + LangChain + Qdrant + HuggingFace Embeddings |

## 微服务架构

```
Frontend (web:5173)
    ↓ REST / SSE
Backend (server:3000)
    ├── → Agent (agent:8001)  ← LangGraph 对话/分析
    └── → RAG   (rag:8000)   ← 向量检索（与 server 解耦）
         ↑
    Agent 也可直接调用 RAG
```

RAG 服务与后端**完全解耦**：通过 HTTP REST 通信，无代码依赖，可独立部署和扩展。

## 快速开始

### 前置依赖

- Node.js >= 20
- pnpm >= 9
- Python >= 3.11（仅 RAG 服务）

### 安装依赖

```bash
# 安装 Node.js 依赖（所有 JS/TS 子项目）
pnpm install

# 安装 Python 依赖（RAG 服务）
cd apps/rag && pip install -e ".[dev]"
```

### 开发启动

```bash
# 启动所有 JS/TS 服务（前端 + 后端 + Agent）
pnpm dev

# 单独启动前端
pnpm dev:web

# 单独启动后端
pnpm dev:server

# 单独启动 Agent
pnpm dev:agent

# 启动 RAG 服务（独立 Python 环境）
cd apps/rag && make dev
```

### 环境变量

各子项目根目录下有 `.env.example`，复制为 `.env` 并填入对应配置：

```bash
cp apps/server/.env.example apps/server/.env
cp apps/agent/.env.example apps/agent/.env
cp apps/rag/.env.example    apps/rag/.env
```

## 前端页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 欢迎页 | 未登录用户的 Landing page |
| `/login` | 登录 | 密码登录 / 验证码登录 |
| `/register` | 注册 | 手机号 + 用户名 + 密码 |
| `/app/chat` | 问答中心 | AD-X Vue 三栏布局，支持流式对话 |
| `/app/history` | 问答历史 | 列表 + 多维度搜索筛选 |
| `/app/analytics` | 学情记录 | 词云 + 薄弱点分析 + AI 总结 |
| `/app/knowledge` | 知识库 | PDF/MD 上传、在线编辑、拖拽排序 |
| `/app/subjects` | 学科管理 | 学科 CRUD + 大纲编辑弹窗 |
| `/app/admin` | 管理中心 | 用户/学科/知识库全局管理 |
| `/app/profile` | 个人信息 | 基本信息 + 修改密码 |
