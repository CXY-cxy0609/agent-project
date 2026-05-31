# apps/server

`apps/server` 为业务后端（Go 版本）入口，承担统一 API、鉴权、会话与任务编排入口能力。

## 当前骨架能力

- 基于 `Go + Gin` 的 API 服务
- 全局前缀 `/api`
- 健康检查接口：`GET /api/health`（含数据库/Redis依赖探针）
- CORS、基础日志、统一配置加载（支持 `.env`）
- 环境变量兼容映射（保留旧字段，便于真实配置平滑迁移）
- `request-id` 与 `idempotency-key` 中间件
- `auth/subject/conversation/task` 四个业务模块骨架（service/repository 分层）
- internal gRPC proto 合约（`api/proto/task/v1/task.proto`）
- gRPC 服务启动骨架（`cmd/grpc`）
- internal 学习记录接口（`/api/learning-records`，`x-internal-token` 保护）

## 目录结构

```text
apps/server
├── api/proto/task/v1/task.proto
├── cmd/{server,grpc}/main.go
├── internal
│   ├── app/container.go
│   ├── config/config.go
│   ├── health/service.go
│   ├── infra/{database,cache}
│   ├── repository/*
│   ├── service/*
│   └── http/*
├── go.mod
└── .env.example
```

## 启动方式

在 `apps/server` 目录执行：

```bash
pnpm dev
```

默认访问地址：

- `http://localhost:3000/`
- `http://localhost:3000/api/health`

gRPC 默认端口：

- `:50051`（由 `GRPC_PORT` 控制）

gRPC 健康检查（可选）：

```bash
grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check
```

如果 `pnpm dev` 提示找不到 `air`，可直接执行：

```bash
"$(go env GOPATH)/bin/air" -c .air.toml
```

### 端口占用排查（`listen tcp :3000: bind: address already in use`）

当 `pnpm dev` 启动失败并提示 `address already in use` 时，说明 `3000` 端口已被其他进程占用。

1) 查看占用 `3000` 的进程：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

2) 停止占用进程（示例 `PID` 为 `40922`）：

```bash
kill 40922
```

3) 如果进程未退出，再强制停止：

```bash
kill -9 40922
```

4) 确认端口已释放（无输出即表示已释放）：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

## 环境变量与迁移注意事项

关键原则：**不要清空已有 `.env` 中真实云配置**（数据库、Redis、内网地址等），只做增量迁移。

当前配置兼容策略：

- 数据库支持旧字段：`DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME`
- 新增 `DB_DRIVER`（默认 `mysql`，可切 `postgres`）
- 新增 `DB_DSN`（优先级高于拆分字段）
- Redis 支持旧字段：`REDIS_HOST/REDIS_PORT`，也支持新字段 `REDIS_ADDR`
- Redis 可选新增 `REDIS_USERNAME`

推荐新增字段（不影响旧字段）：

- `DB_DRIVER`
- `DB_DSN`
- `REDIS_ADDR`
- `REDIS_USERNAME`
- `KAFKA_BROKERS`
- `GRPC_PORT`
- `INTERNAL_TOKEN`

## 数据库建表脚本

服务不再在代码中执行自动建表，请在部署前手动执行 SQL 文件：

- MySQL: `sql/mysql/001_init_schema.sql`
- PostgreSQL: `sql/postgres/001_init_schema.sql`

建表规范：

- 每张表都包含自增主键 `id`
- 每张表都包含业务唯一标识字段（如 `subject_id`、`conversation_id`、`task_id`、`record_id`）

## 下一步规划（代码层）

- 持续完善 SQL 仓储与索引优化
- 完成 gRPC service 注册与 proto stub 生成接线
- 加入 OpenTelemetry 指标与 tracing
