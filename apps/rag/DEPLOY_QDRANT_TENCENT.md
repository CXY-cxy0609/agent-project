# 腾讯云部署 Qdrant 操作手册（给 `apps/rag` 使用）

这份文档用于把你当前 RAG 项目接到腾讯云上的 Qdrant。  
目标是：**不改业务代码，今晚按步骤跑通**。

---

## 0. 方案说明

你当前项目已经使用 `qdrant-client`（见 `src/indexer/vector_store.py`），最省事方案是：

- 在腾讯云租一台主机（CVM 或轻量应用服务器）
- 在主机上部署 Qdrant（Docker）
- 在 `apps/rag/.env` 配置 `QDRANT_URL` 和 `QDRANT_API_KEY`

> 不需要把代码迁移到腾讯云 VectorDB SDK。

---

## 1. 前置准备

### 1.1 云主机建议

- 系统：`Ubuntu 22.04`
- 规格：测试 `2C4G` 起步（生产视数据量调整）
- 磁盘：建议 `50GB+`（向量数据会持续增长）

### 1.2 安全组（重点）

至少放行：

- `22`（SSH），来源建议仅你的办公公网 IP
- `6333`（Qdrant HTTP），**建议仅允许 RAG 服务机器 IP**

不要把 `6333` 全网开放。

---

## 2. 服务器安装 Docker

SSH 登录云主机后执行：

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
docker --version
docker compose version
```

---

## 3. 部署 Qdrant（含持久化和 API Key）

### 3.1 创建目录

```bash
mkdir -p ~/qdrant/{storage,snapshots}
cd ~/qdrant
```

### 3.2 创建 `docker-compose.yml`

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
    volumes:
      - ./storage:/qdrant/storage
      - ./snapshots:/qdrant/snapshots
    environment:
      QDRANT__SERVICE__API_KEY: "替换成强密码_至少20位"
```

### 3.3 启动

```bash
docker compose up -d
docker compose ps
docker logs qdrant --tail 50
```

---

## 4. 验证 Qdrant 可用

### 4.1 服务器本机验证

```bash
curl http://127.0.0.1:6333/healthz
```

返回类似 `healthz check passed` 说明服务正常。

### 4.2 远程验证（可选）

如果安全组已允许你的 IP：

- 打开 `http://<云主机公网IP>:6333/dashboard`
- 输入 API Key

---

## 5. 配置 RAG 项目连接 Qdrant

修改 `apps/rag/.env`（没有就从 `.env.example` 复制）：

```env
QDRANT_URL=http://<云主机公网IP>:6333
QDRANT_API_KEY=<你在docker-compose里配置的key>

QDRANT_COLLECTION=tutor_knowledge
QDRANT_USER_MEMORY_COLLECTION=tutor_user_memory
QDRANT_VIDEO_CACHE_COLLECTION=tutor_video_cache
```

你的代码会自动建 collection（`ensure_collection`），第一次写入会创建。

---

## 6. 启动 RAG 并联调

在本地项目执行：

```bash
cd apps/rag
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m src.main
```

新开一个终端验证：

```bash
curl http://127.0.0.1:8000/health
```

### 6.1 快速写入测试数据

```bash
curl -X POST "http://127.0.0.1:8000/index/text" \
  -H "Content-Type: application/json" \
  -d '{
    "text":"# 导数基础\n\n导数表示函数在某一点附近的瞬时变化率。设函数 y=f(x)，当自变量 x 发生一个很小的增量时，函数值也会产生变化。若变化比值在增量趋近于零时存在极限，则该极限称为导数。导数可以用于研究函数单调性、极值与凹凸性，也常用于物理中的速度和加速度计算。",
    "knowledge_base_id":"kb_demo",
    "subject_id":"math",
    "doc_name":"test_doc"
  }'
```

> 如果返回 `{"chunks":0,"status":"empty"}`，通常是文本太短，被最小切分阈值过滤（默认 `min_chunk_size=50`）。

### 6.2 快速检索测试

```bash
curl -X POST "http://127.0.0.1:8000/retrieve" \
  -H "Content-Type: application/json" \
  -d '{
    "query":"导数是什么",
    "knowledge_base_id":"kb_demo",
    "subject_id":"math",
    "top_k":3
  }'
```

若返回 `context` 和 `chunks`，表示链路跑通。

---

## 7. 常见问题排查

### 7.1 连接超时 / 拒绝连接

- 检查安全组是否放行 `6333`
- 检查容器是否启动：`docker compose ps`
- 检查进程日志：`docker logs qdrant --tail 200`

### 7.2 报 API Key 相关错误

- `QDRANT_API_KEY` 与 `docker-compose.yml` 中是否一致
- 是否误用了旧 `.env`

### 7.3 能连上但检索为空

- 是否先执行了 `/index/text` 或 `/index/upload`
- `knowledge_base_id`、`subject_id` 检索条件是否和入库一致
- 入库文本是否过短（默认 `min_chunk_size=50`，太短会出现 `chunks=0`）

### 7.4 首次启动慢

- 你的 embedding/reranker 模型会首次下载（`sentence-transformers`）
- 网络受限时建议配置镜像或提前缓存模型

---

## 8. 生产建议（后续再做）

- 将 Qdrant 与 RAG 放在同一 VPC 内网互通
- `6333` 仅内网访问，外部流量走网关/Nginx
- 为 `~/qdrant/storage` 做定期快照备份
- 监控 CPU、内存、磁盘、容器重启次数
- 数据量上来后再评估升配或分片

---

## 9. 回滚/重建命令（谨慎）

只在测试环境使用：

```bash
cd ~/qdrant
docker compose down
```

清空数据（会删除全部向量）：

```bash
rm -rf ~/qdrant/storage/*
rm -rf ~/qdrant/snapshots/*
docker compose up -d
```

---

按这份文档执行，通常 30-60 分钟可以跑通首条检索链路。
