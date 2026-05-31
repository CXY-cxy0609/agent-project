-- apps/server/sql/mysql/001_init_schema.sql
-- 约束：每张表均包含自增 id，同时保留业务唯一标识字段。

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL,
  education_stage VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_subjects_subject_id (subject_id),
  UNIQUE KEY uk_subjects_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subject_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_conversations_conversation_id (conversation_id),
  KEY idx_conversations_user_subject_created_at (user_id, subject_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id VARCHAR(80) NOT NULL,
  type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  trace_id VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tasks_task_id (task_id),
  KEY idx_tasks_trace_id (trace_id),
  KEY idx_tasks_status_created_at (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id VARCHAR(80) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  chapter VARCHAR(128) NOT NULL DEFAULT '',
  knowledge_point VARCHAR(255) NOT NULL,
  difficulty VARCHAR(16) NOT NULL DEFAULT 'medium',
  asked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_learning_records_record_id (record_id),
  KEY idx_learning_records_user_asked_at (user_id, asked_at),
  KEY idx_learning_records_user_subject_chapter (user_id, subject, chapter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
