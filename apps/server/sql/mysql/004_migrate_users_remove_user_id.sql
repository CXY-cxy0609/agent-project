-- apps/server/sql/mysql/004_migrate_users_remove_user_id.sql
-- 目标：
-- 1) users 表移除冗余 user_id 字段，仅保留主键 id
-- 2) 所有 user_id 外键改为引用 users(id)
-- 3) 历史数据按 users.user_id -> users.id 做映射迁移

USE tutor_db;

-- 先把业务表中的 user_id 映射成 users.id
UPDATE user_subjects us
JOIN users u ON us.user_id = u.user_id
SET us.user_id = u.id;

UPDATE conversations c
JOIN users u ON c.user_id = u.user_id
SET c.user_id = u.id;

UPDATE tasks t
JOIN users u ON t.user_id = u.user_id
SET t.user_id = u.id
WHERE t.user_id IS NOT NULL;

UPDATE learning_records lr
JOIN users u ON lr.user_id = u.user_id
SET lr.user_id = u.id;

-- 运行期表（存在时迁移）
SET @kb_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'knowledge_bases'
);
SET @kb_update_sql := IF(
  @kb_exists > 0,
  'UPDATE knowledge_bases kb JOIN users u ON kb.user_id = u.user_id SET kb.user_id = u.id WHERE kb.user_id IS NOT NULL',
  'SELECT 1'
);
PREPARE kb_update_stmt FROM @kb_update_sql;
EXECUTE kb_update_stmt;
DEALLOCATE PREPARE kb_update_stmt;

SET @as_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'analytics_summaries'
);
SET @as_update_sql := IF(
  @as_exists > 0,
  'UPDATE analytics_summaries a JOIN users u ON a.user_id = u.user_id SET a.user_id = u.id',
  'SELECT 1'
);
PREPARE as_update_stmt FROM @as_update_sql;
EXECUTE as_update_stmt;
DEALLOCATE PREPARE as_update_stmt;

-- 删除旧外键
ALTER TABLE user_subjects DROP FOREIGN KEY fk_user_subjects_user_id;
ALTER TABLE conversations DROP FOREIGN KEY fk_conversations_user_id;
ALTER TABLE tasks DROP FOREIGN KEY fk_tasks_user_id;
ALTER TABLE learning_records DROP FOREIGN KEY fk_learning_records_user_id;

SET @kb_fk_drop_sql := IF(
  @kb_exists > 0,
  'ALTER TABLE knowledge_bases DROP FOREIGN KEY fk_knowledge_bases_user_id',
  'SELECT 1'
);
PREPARE kb_fk_drop_stmt FROM @kb_fk_drop_sql;
EXECUTE kb_fk_drop_stmt;
DEALLOCATE PREPARE kb_fk_drop_stmt;

SET @as_fk_drop_sql := IF(
  @as_exists > 0,
  'ALTER TABLE analytics_summaries DROP FOREIGN KEY fk_analytics_user_id',
  'SELECT 1'
);
PREPARE as_fk_drop_stmt FROM @as_fk_drop_sql;
EXECUTE as_fk_drop_stmt;
DEALLOCATE PREPARE as_fk_drop_stmt;

-- users 删除 user_id 字段
ALTER TABLE users DROP INDEX uk_users_user_id;
ALTER TABLE users DROP COLUMN user_id;

-- 重新建立指向 users(id) 的外键
ALTER TABLE user_subjects
  ADD CONSTRAINT fk_user_subjects_user_id FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE conversations
  ADD CONSTRAINT fk_conversations_user_id FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_user_id FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE learning_records
  ADD CONSTRAINT fk_learning_records_user_id FOREIGN KEY (user_id) REFERENCES users(id);

SET @kb_fk_add_sql := IF(
  @kb_exists > 0,
  'ALTER TABLE knowledge_bases ADD CONSTRAINT fk_knowledge_bases_user_id FOREIGN KEY (user_id) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE kb_fk_add_stmt FROM @kb_fk_add_sql;
EXECUTE kb_fk_add_stmt;
DEALLOCATE PREPARE kb_fk_add_stmt;

SET @as_fk_add_sql := IF(
  @as_exists > 0,
  'ALTER TABLE analytics_summaries ADD CONSTRAINT fk_analytics_user_id FOREIGN KEY (user_id) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE as_fk_add_stmt FROM @as_fk_add_sql;
EXECUTE as_fk_add_stmt;
DEALLOCATE PREPARE as_fk_add_stmt;
