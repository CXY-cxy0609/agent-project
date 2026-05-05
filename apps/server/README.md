# @tutor/server

`@tutor/server` 是考研智能辅导平台的后端服务，基于 NestJS。

## 功能概览

- 提供统一后端 API（全局前缀为 `/api`）
- 提供基础健康检查接口：`GET /api/health`
- 支持 MySQL、Redis、JWT 等基础能力

## 运行环境

- Node.js >= 20
- pnpm >= 9
- 可用的 MySQL 与 Redis（本地或云服务）

## 快速开始

1. 在仓库根目录安装依赖：

```bash
pnpm install
```

2. 配置环境变量（在 `apps/server` 下）：

```bash
cp .env.example .env
```

3. 按实际环境修改 `.env` 中的数据库、Redis、JWT 等配置。

## 启动方式

### 方式一：在仓库根目录启动（推荐）

```bash
pnpm dev:server
```

### 方式二：在 `apps/server` 目录启动

```bash
pnpm dev
```

服务默认启动在 `http://localhost:3000/api`（端口可通过 `PORT` 调整）。

## 常用命令

在 `apps/server` 目录下执行：

```bash
pnpm dev      # 开发模式（watch）
pnpm build    # 构建
pnpm start    # 运行构建产物（dist/main.js）
pnpm lint     # ESLint 修复
pnpm test     # 单元测试
```

## 健康检查

启动后可访问：

```bash
curl http://localhost:3000/api/health
```

预期返回类似：

```json
{
  "status": "ok",
  "service": "tutor-server",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## 环境变量说明

关键变量见 `apps/server/.env.example`，常用项如下：

- `PORT`：服务端口
- `FRONTEND_URL`：允许跨域的前端地址
- `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME`：MySQL 连接
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`：Redis 连接
- `JWT_SECRET` / `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`：JWT 配置
- `RAG_SERVICE_URL` / `AGENT_SERVICE_URL`：内部服务地址

## 常见问题

- 数据库连不上：
  - 检查 `DB_HOST`、`DB_PORT` 是否与云数据库实际连接信息一致
  - 云数据库通常需要在控制台配置 IP 白名单
- Redis 连不上：
  - 检查 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`
- 前端跨域失败：
  - 检查 `FRONTEND_URL` 是否与前端实际地址一致
