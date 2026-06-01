-- apps/server/sql/mysql/001_init_schema.sql
-- 约束：每张表均包含自增 id，同时保留业务唯一标识字段。

CREATE DATABASE IF NOT EXISTS tutor_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE tutor_db;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'student',
  status TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_phone (phone),
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id BIGINT UNSIGNED NOT NULL,
  parent_subject_id BIGINT UNSIGNED DEFAULT NULL,
  level TINYINT NOT NULL DEFAULT 1,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(64) NOT NULL,
  education_stage VARCHAR(32) NOT NULL DEFAULT '',
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_subjects_subject_id (subject_id),
  UNIQUE KEY uk_subjects_code (code),
  KEY idx_subjects_parent_subject_id (parent_subject_id),
  KEY idx_subjects_level (level),
  CONSTRAINT fk_subjects_parent_subject_id FOREIGN KEY (parent_subject_id) REFERENCES subjects(subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_subjects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_subject_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_subjects_user_subject_id (user_subject_id),
  UNIQUE KEY uk_user_subjects_user_subject (user_id, subject_id),
  CONSTRAINT fk_user_subjects_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_user_subjects_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_conversations_conversation_id (conversation_id),
  KEY idx_conversations_user_subject_created_at (user_id, subject_id, created_at),
  CONSTRAINT fk_conversations_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_conversations_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id VARCHAR(80) NOT NULL,
  conversation_id VARCHAR(64) NOT NULL,
  seq BIGINT UNSIGNED NOT NULL,
  turn_id VARCHAR(80) DEFAULT NULL,
  reply_to_message_id VARCHAR(80) DEFAULT NULL,
  role VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'done',
  content_inline MEDIUMTEXT,
  content_ref VARCHAR(512) DEFAULT NULL,
  content_hash VARCHAR(128) DEFAULT NULL,
  content_size BIGINT NOT NULL DEFAULT 0,
  token_usage INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_conversation_messages_message_id (message_id),
  UNIQUE KEY uk_conversation_messages_conversation_seq (conversation_id, seq),
  KEY idx_conversation_messages_conversation_created_at (conversation_id, created_at),
  KEY idx_conversation_messages_conversation_turn (conversation_id, turn_id),
  KEY idx_conversation_messages_reply_to_message_id (reply_to_message_id),
  KEY idx_conversation_messages_status_created_at (status, created_at),
  CONSTRAINT fk_conversation_messages_conversation_id FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  task_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  subject_id BIGINT UNSIGNED DEFAULT NULL,
  type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  trace_id VARCHAR(80) NOT NULL,
  payload_json JSON DEFAULT NULL,
  result_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tasks_task_id (task_id),
  KEY idx_tasks_user_created_at (user_id, created_at),
  KEY idx_tasks_subject_created_at (subject_id, created_at),
  KEY idx_tasks_trace_id (trace_id),
  KEY idx_tasks_status_created_at (status, created_at),
  CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_tasks_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED DEFAULT NULL,
  session_id VARCHAR(64) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  chapter VARCHAR(128) NOT NULL DEFAULT '',
  knowledge_point VARCHAR(255) NOT NULL,
  difficulty VARCHAR(16) NOT NULL DEFAULT 'medium',
  asked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_learning_records_record_id (record_id),
  KEY idx_learning_records_user_subject_id (user_id, subject_id),
  KEY idx_learning_records_user_asked_at (user_id, asked_at),
  KEY idx_learning_records_user_subject_chapter (user_id, subject, chapter),
  CONSTRAINT fk_learning_records_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_learning_records_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
