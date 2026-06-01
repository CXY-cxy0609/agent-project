-- apps/server/sql/mysql/005_alter_conversation_messages_for_external_content.sql
-- 目标：在保留现有表的前提下，升级为“元数据 + 外置内容引用”模型。

USE tutor_db;

ALTER TABLE conversation_messages
  ADD COLUMN seq BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER conversation_id,
  ADD COLUMN turn_id VARCHAR(80) DEFAULT NULL AFTER seq,
  ADD COLUMN reply_to_message_id VARCHAR(80) DEFAULT NULL AFTER turn_id,
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'done' AFTER role,
  ADD COLUMN content_inline MEDIUMTEXT AFTER status,
  ADD COLUMN content_ref VARCHAR(512) DEFAULT NULL AFTER content_inline,
  ADD COLUMN content_hash VARCHAR(128) DEFAULT NULL AFTER content_ref,
  ADD COLUMN content_size BIGINT NOT NULL DEFAULT 0 AFTER content_hash;

UPDATE conversation_messages
SET content_inline = content
WHERE content_inline IS NULL;

UPDATE conversation_messages
SET content_size = CHAR_LENGTH(content_inline)
WHERE content_size = 0 AND content_inline IS NOT NULL;

UPDATE conversation_messages m
JOIN (
  SELECT
    cm.id,
    ROW_NUMBER() OVER (
      PARTITION BY cm.conversation_id
      ORDER BY cm.created_at, cm.id
    ) AS new_seq
  FROM conversation_messages cm
) s ON s.id = m.id
SET m.seq = s.new_seq;

ALTER TABLE conversation_messages
  DROP INDEX idx_conversation_messages_conversation_created_at,
  ADD UNIQUE KEY uk_conversation_messages_conversation_seq (conversation_id, seq),
  ADD KEY idx_conversation_messages_conversation_created_at (conversation_id, created_at),
  ADD KEY idx_conversation_messages_conversation_turn (conversation_id, turn_id),
  ADD KEY idx_conversation_messages_reply_to_message_id (reply_to_message_id),
  ADD KEY idx_conversation_messages_status_created_at (status, created_at);

ALTER TABLE conversation_messages
  DROP COLUMN content;
