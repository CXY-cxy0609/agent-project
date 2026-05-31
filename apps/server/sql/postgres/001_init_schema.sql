-- apps/server/sql/postgres/001_init_schema.sql
-- 约束：每张表均包含自增 id，同时保留业务唯一标识字段。

CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(32) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'student',
  status SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id BIGINT NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  education_stage VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_subject_id VARCHAR(80) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  subject_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, subject_id),
  CONSTRAINT fk_user_subjects_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_subjects_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  subject_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_conversations_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_conversations_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_subject_created_at
  ON conversations (user_id, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id VARCHAR(80) NOT NULL UNIQUE,
  conversation_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  token_usage INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_conversation_messages_conversation_id FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created_at
  ON conversation_messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id VARCHAR(80) NOT NULL UNIQUE,
  user_id BIGINT,
  subject_id BIGINT,
  type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  trace_id VARCHAR(80) NOT NULL,
  payload_json JSONB,
  result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_tasks_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_trace_id ON tasks (trace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created_at ON tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_subject_created_at ON tasks (subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id VARCHAR(80) NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  subject_id BIGINT,
  session_id VARCHAR(64) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  chapter VARCHAR(128) NOT NULL DEFAULT '',
  knowledge_point VARCHAR(255) NOT NULL,
  difficulty VARCHAR(16) NOT NULL DEFAULT 'medium',
  asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_learning_records_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_learning_records_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_records_user_asked_at
  ON learning_records (user_id, asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_learning_records_user_subject_chapter
  ON learning_records (user_id, subject, chapter);
CREATE INDEX IF NOT EXISTS idx_learning_records_user_subject_id
  ON learning_records (user_id, subject_id);
