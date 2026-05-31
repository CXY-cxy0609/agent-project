-- apps/server/sql/postgres/001_init_schema.sql
-- 约束：每张表均包含自增 id，同时保留业务唯一标识字段。

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  education_stage VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  subject_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_subject_created_at
  ON conversations (user_id, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id VARCHAR(80) NOT NULL UNIQUE,
  type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  trace_id VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_trace_id ON tasks (trace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks (status, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id VARCHAR(80) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  chapter VARCHAR(128) NOT NULL DEFAULT '',
  knowledge_point VARCHAR(255) NOT NULL,
  difficulty VARCHAR(16) NOT NULL DEFAULT 'medium',
  asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_records_user_asked_at
  ON learning_records (user_id, asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_records_user_subject_chapter
  ON learning_records (user_id, subject, chapter);
