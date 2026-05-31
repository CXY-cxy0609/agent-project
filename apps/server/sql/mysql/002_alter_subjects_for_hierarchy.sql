-- apps/server/sql/mysql/002_alter_subjects_for_hierarchy.sql
-- 适用于已执行过 001_init_schema.sql 的数据库。
-- 为 subjects 表增加子学科层级支持字段。

USE tutor_db;

ALTER TABLE subjects
  ADD COLUMN parent_subject_id BIGINT UNSIGNED NULL AFTER subject_id,
  ADD COLUMN level TINYINT NOT NULL DEFAULT 1 AFTER parent_subject_id,
  ADD COLUMN description VARCHAR(255) NULL AFTER education_stage;

UPDATE subjects
SET level = 1
WHERE level IS NULL OR level = 0;

ALTER TABLE subjects
  ADD KEY idx_subjects_parent_subject_id (parent_subject_id),
  ADD KEY idx_subjects_level (level),
  ADD CONSTRAINT fk_subjects_parent_subject_id FOREIGN KEY (parent_subject_id) REFERENCES subjects(subject_id);

