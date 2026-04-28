# RAG 服务（`tutor-rag`）

基于 FastAPI + Qdrant + sentence-transformers 的知识检索服务，负责文档解析、切分、向量化、检索与重排，并向 Agent 提供统一 HTTP 接口。

## 1. 项目结构设计

```text
apps/rag
├── src/main.py                     # FastAPI 入口与全部 REST API
├── src/config.py                   # 配置中心（Pydantic Settings）
├── src/pipeline
│   ├── retrieval_pipeline.py       # 检索主链路：预处理→召回→重排→上下文构建
│   ├── query_preprocessor.py       # Query 预处理（含 HyDE 扩展）
│   └── context_builder.py          # 上下文压缩与拼接
├── src/indexer
│   ├── indexer.py                  # 入库主链路：解析→切分→向量化→写入
│   ├── document_parser.py          # 文档解析（PDF/Markdown/Text）
│   ├── chunker.py                  # 语义切分与短块合并
│   └── vector_store.py             # Qdrant 读写封装
├── src/embedder/embedder.py        # Embedding 服务（支持 Redis 缓存）
├── src/reranker/reranker.py        # Cross-Encoder 重排
├── src/services/memory_service.py  # 用户记忆/内容缓存向量接口
├── pyproject.toml                  # Python 项目与依赖定义
└── .env.example                    # 环境变量模板
```

### 关键设计

- **无 LangChain 依赖**：检索与索引流程完全自建，便于控制性能与可观测性。
- **检索质量链路**：`Query 预处理 + HyDE + 向量召回 + Rerank + Context Builder`。
- **索引稳定性**：按文档类型选择切分策略（Markdown 标题切分 / 纯文本滑窗切分）。
- **缓存优化**：Embedding 结果支持 Redis 缓存，减少重复向量计算成本。

## 2. 运行方式

## 前置依赖

- Python >= 3.9
- Qdrant（默认 `http://localhost:6333`）
- 可选：Redis（Embedding 缓存、RAG 缓存）

## 环境变量

```bash
cd apps/rag
cp .env.example .env
```

关键配置项：

- `QDRANT_URL`
- `QDRANT_COLLECTION`
- `EMBEDDING_MODEL`
- `RERANKER_ENABLED`
- `TOP_K_RETRIEVE` / `TOP_K_RERANK`
- 可选：`ANTHROPIC_API_KEY`（用于 HyDE 查询扩展）

## 安装依赖

在 `apps/rag` 目录执行（任选一种方式）：

```bash
# 方式一：标准 venv + pip
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

```bash
# 方式二：如果你使用 uv
uv sync
```

## 启动开发环境

```bash
cd apps/rag
source .venv/bin/activate
python -m src.main
```

服务默认监听：`0.0.0.0:8000`（由 `PORT` 与 `DEBUG` 控制）。

也可直接用 uvicorn：

```bash
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

## 3. 核心接口

- `GET /health`：健康检查
- `POST /retrieve`：语义检索（返回 context + chunks）
- `POST /index/upload`：上传文档并入库
- `POST /index/text`：直接提交文本并入库
- `DELETE /index/{knowledge_base_id}/{doc_id}`：删除文档向量
- `POST /parse`：仅解析文档，不入库
- `POST /memory/user/search|store`：用户向量记忆
- `POST /memory/content/search|store`：内容向量缓存（Video Agent）

## 4. 与 Agent 联动

- Agent 通过 `RAG_SERVICE_URL` 调用本服务。
- 推荐启动顺序：先启动 Qdrant / Redis，再启动本服务，最后启动 `apps/agent`。
