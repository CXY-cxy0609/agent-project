-- Enterprise learning analytics, subject identity, and assessment tables.
-- Run after existing 001-009 migrations.

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND CONSTRAINT_NAME = 'fk_subjects_parent_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `subjects` DROP FOREIGN KEY `fk_subjects_parent_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subjects' AND CONSTRAINT_NAME = 'fk_user_subjects_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `user_subjects` DROP FOREIGN KEY `fk_user_subjects_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND CONSTRAINT_NAME = 'fk_conversations_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `conversations` DROP FOREIGN KEY `fk_conversations_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND CONSTRAINT_NAME = 'fk_tasks_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `tasks` DROP FOREIGN KEY `fk_tasks_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'learning_records' AND CONSTRAINT_NAME = 'fk_learning_records_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `learning_records` DROP FOREIGN KEY `fk_learning_records_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'subject_outlines' AND CONSTRAINT_NAME = 'fk_subject_outlines_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `subject_outlines` DROP FOREIGN KEY `fk_subject_outlines_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_bases' AND CONSTRAINT_NAME = 'fk_knowledge_bases_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `knowledge_bases` DROP FOREIGN KEY `fk_knowledge_bases_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_summaries' AND CONSTRAINT_NAME = 'fk_analytics_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `analytics_summaries` DROP FOREIGN KEY `fk_analytics_subject_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE user_subjects us JOIN subjects s ON us.subject_id = s.subject_id SET us.subject_id = s.id;
UPDATE conversations c JOIN subjects s ON c.subject_id = s.subject_id SET c.subject_id = s.id;
UPDATE tasks t JOIN subjects s ON t.subject_id = s.subject_id SET t.subject_id = s.id WHERE t.subject_id IS NOT NULL;
UPDATE learning_records lr JOIN subjects s ON lr.subject_id = s.subject_id SET lr.subject_id = s.id WHERE lr.subject_id IS NOT NULL;
UPDATE subject_outlines so JOIN subjects s ON so.subject_id = s.subject_id SET so.subject_id = s.id;
UPDATE knowledge_bases kb JOIN subjects s ON kb.subject_id = s.subject_id SET kb.subject_id = s.id WHERE kb.subject_id IS NOT NULL;
UPDATE analytics_summaries a JOIN subjects s ON a.subject_id = s.subject_id SET a.subject_id = s.id;
UPDATE subjects child JOIN subjects parent ON child.parent_subject_id = parent.subject_id SET child.parent_subject_id = parent.id WHERE child.parent_subject_id IS NOT NULL;
UPDATE subjects SET subject_id = id;

ALTER TABLE subjects MODIFY COLUMN subject_id BIGINT UNSIGNED NULL;
ALTER TABLE analytics_summaries MODIFY COLUMN subject_id BIGINT UNSIGNED NULL;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND INDEX_NAME = 'uk_subjects_code'), 'ALTER TABLE `subjects` DROP INDEX `uk_subjects_code`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND COLUMN_NAME = 'code'), 'ALTER TABLE `subjects` DROP COLUMN `code`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND CONSTRAINT_NAME = 'fk_subjects_parent_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `subjects` ADD CONSTRAINT `fk_subjects_parent_subject_id` FOREIGN KEY (`parent_subject_id`) REFERENCES `subjects`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subjects' AND CONSTRAINT_NAME = 'fk_user_subjects_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `user_subjects` ADD CONSTRAINT `fk_user_subjects_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND CONSTRAINT_NAME = 'fk_conversations_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND CONSTRAINT_NAME = 'fk_tasks_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `tasks` ADD CONSTRAINT `fk_tasks_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'learning_records' AND CONSTRAINT_NAME = 'fk_learning_records_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `learning_records` ADD CONSTRAINT `fk_learning_records_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'subject_outlines' AND CONSTRAINT_NAME = 'fk_subject_outlines_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `subject_outlines` ADD CONSTRAINT `fk_subject_outlines_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_bases' AND CONSTRAINT_NAME = 'fk_knowledge_bases_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `knowledge_bases` ADD CONSTRAINT `fk_knowledge_bases_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'analytics_summaries' AND CONSTRAINT_NAME = 'fk_analytics_subject_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `analytics_summaries` ADD CONSTRAINT `fk_analytics_subject_id` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS learning_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  session_id VARCHAR(80) DEFAULT NULL,
  conversation_id VARCHAR(80) DEFAULT NULL,
  message_id VARCHAR(80) DEFAULT NULL,
  subject_id BIGINT UNSIGNED DEFAULT NULL,
  subject_name_snapshot VARCHAR(255) DEFAULT NULL,
  chapter VARCHAR(128) DEFAULT NULL,
  knowledge_key VARCHAR(255) NOT NULL,
  knowledge_point VARCHAR(255) NOT NULL,
  difficulty VARCHAR(16) NOT NULL DEFAULT 'medium',
  source_type VARCHAR(32) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  confidence DECIMAL(5,4) DEFAULT NULL,
  metadata_json JSON DEFAULT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_learning_events_event_id (event_id),
  KEY idx_learning_events_user_occurred_at (user_id, occurred_at),
  KEY idx_learning_events_user_subject (user_id, subject_id),
  KEY idx_learning_events_knowledge_key (knowledge_key),
  CONSTRAINT fk_learning_events_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_learning_events_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_knowledge_stats (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED DEFAULT NULL,
  knowledge_key VARCHAR(255) NOT NULL,
  knowledge_point VARCHAR(255) NOT NULL,
  ask_count INT NOT NULL DEFAULT 0,
  test_count INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  wrong_count INT NOT NULL DEFAULT 0,
  mastery_score DECIMAL(5,2) NOT NULL DEFAULT 50,
  weakness_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP NULL DEFAULT NULL,
  formula_version VARCHAR(32) NOT NULL DEFAULT 'v1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_learning_stats_user_subject_key (user_id, subject_id, knowledge_key),
  KEY idx_learning_stats_user_weakness (user_id, weakness_score),
  CONSTRAINT fk_learning_stats_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_learning_stats_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_aliases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  knowledge_key VARCHAR(255) NOT NULL,
  alias VARCHAR(255) NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'system',
  confidence DECIMAL(5,4) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_knowledge_alias (knowledge_key, alias),
  KEY idx_knowledge_alias_lookup (alias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assessment_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  subject_id BIGINT UNSIGNED DEFAULT NULL,
  source VARCHAR(32) NOT NULL,
  mode VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  generation_config_json JSON NOT NULL,
  knowledge_points_json JSON NOT NULL,
  time_limit_seconds INT DEFAULT NULL,
  total_score DECIMAL(8,2) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  graded_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_assessment_sessions_id (assessment_id),
  KEY idx_assessment_sessions_user_created (user_id, created_at),
  KEY idx_assessment_sessions_subject (subject_id),
  CONSTRAINT fk_assessment_sessions_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_assessment_sessions_subject_id FOREIGN KEY (subject_id) REFERENCES subjects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  question_id VARCHAR(80) NOT NULL,
  assessment_id VARCHAR(80) NOT NULL,
  knowledge_key VARCHAR(255) NOT NULL,
  question_type VARCHAR(32) NOT NULL,
  stem TEXT NOT NULL,
  options_json JSON DEFAULT NULL,
  answer_json JSON NOT NULL,
  rubric_json JSON DEFAULT NULL,
  difficulty VARCHAR(16) NOT NULL,
  score DECIMAL(6,2) NOT NULL DEFAULT 1,
  explanation TEXT,
  source_refs_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_assessment_questions_id (question_id),
  KEY idx_assessment_questions_assessment (assessment_id),
  CONSTRAINT fk_assessment_questions_assessment_id FOREIGN KEY (assessment_id) REFERENCES assessment_sessions(assessment_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  assessment_id VARCHAR(80) NOT NULL,
  question_id VARCHAR(80) NOT NULL,
  user_answer_json JSON NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  score DECIMAL(6,2) NOT NULL DEFAULT 0,
  feedback TEXT,
  graded_by VARCHAR(32) NOT NULL DEFAULT 'rule',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_assessment_answers_question (assessment_id, question_id),
  CONSTRAINT fk_assessment_answers_assessment_id FOREIGN KEY (assessment_id) REFERENCES assessment_sessions(assessment_id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_answers_question_id FOREIGN KEY (question_id) REFERENCES assessment_questions(question_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_answers' AND COLUMN_NAME = 'attachments_json'), 'ALTER TABLE `assessment_answers` ADD COLUMN `attachments_json` JSON DEFAULT NULL AFTER `user_answer_json`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_answers' AND COLUMN_NAME = 'score_ratio'), 'ALTER TABLE `assessment_answers` ADD COLUMN `score_ratio` DECIMAL(6,4) DEFAULT NULL AFTER `score`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_answers' AND COLUMN_NAME = 'rubric_scores_json'), 'ALTER TABLE `assessment_answers` ADD COLUMN `rubric_scores_json` JSON DEFAULT NULL AFTER `feedback`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_answers' AND COLUMN_NAME = 'image_understanding_json'), 'ALTER TABLE `assessment_answers` ADD COLUMN `image_understanding_json` JSON DEFAULT NULL AFTER `rubric_scores_json`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS assessment_answer_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attachment_id VARCHAR(80) NOT NULL,
  assessment_id VARCHAR(80) NOT NULL,
  question_id VARCHAR(80) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  url VARCHAR(1024) NOT NULL,
  storage_key VARCHAR(512) DEFAULT NULL,
  hash VARCHAR(128) DEFAULT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'done',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_assessment_answer_attachments_id (attachment_id),
  KEY idx_assessment_answer_attachments_question (assessment_id, question_id),
  CONSTRAINT fk_assessment_answer_attachments_assessment_id FOREIGN KEY (assessment_id) REFERENCES assessment_sessions(assessment_id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_answer_attachments_question_id FOREIGN KEY (question_id) REFERENCES assessment_questions(question_id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_answer_attachments_user_id FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_bases' AND COLUMN_NAME = 'tenant_id'), 'ALTER TABLE `knowledge_bases` ADD COLUMN `tenant_id` VARCHAR(80) NOT NULL DEFAULT ''public'' AFTER `knowledge_base_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_bases' AND COLUMN_NAME = 'visibility'), 'ALTER TABLE `knowledge_bases` ADD COLUMN `visibility` VARCHAR(16) NOT NULL DEFAULT ''public'' AFTER `type`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_bases' AND COLUMN_NAME = 'owner_user_id'), 'ALTER TABLE `knowledge_bases` ADD COLUMN `owner_user_id` BIGINT UNSIGNED DEFAULT NULL AFTER `user_id`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_bases' AND INDEX_NAME = 'idx_knowledge_bases_acl'), 'ALTER TABLE `knowledge_bases` ADD KEY `idx_knowledge_bases_acl` (`tenant_id`, `visibility`, `owner_user_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_bases' AND CONSTRAINT_NAME = 'fk_knowledge_bases_owner_user_id' AND CONSTRAINT_TYPE = 'FOREIGN KEY'), 'ALTER TABLE `knowledge_bases` ADD CONSTRAINT `fk_knowledge_bases_owner_user_id` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE knowledge_bases
SET visibility = CASE WHEN type = 'private' THEN 'private' ELSE 'public' END,
    owner_user_id = user_id
WHERE owner_user_id IS NULL;

