-- apps/server/sql/postgres/002_alter_conversation_messages_for_external_content.sql
-- 目标：升级 conversation_messages 为“元数据 + 外置内容引用”模型。

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS seq BIGINT,
  ADD COLUMN IF NOT EXISTS turn_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS reply_to_message_id VARCHAR(80),
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS content_inline TEXT,
  ADD COLUMN IF NOT EXISTS content_ref VARCHAR(512),
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS content_size BIGINT NOT NULL DEFAULT 0;

UPDATE conversation_messages
SET content_inline = content
WHERE content_inline IS NULL;

UPDATE conversation_messages
SET content_size = OCTET_LENGTH(content_inline)
WHERE content_size = 0 AND content_inline IS NOT NULL;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at, id) AS rn
  FROM conversation_messages
)
UPDATE conversation_messages m
SET seq = ranked.rn
FROM ranked
WHERE m.id = ranked.id;

ALTER TABLE conversation_messages
  ALTER COLUMN seq SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uk_conversation_messages_conversation_seq'
  ) THEN
    ALTER TABLE conversation_messages
      ADD CONSTRAINT uk_conversation_messages_conversation_seq UNIQUE (conversation_id, seq);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created_at
  ON conversation_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_turn
  ON conversation_messages (conversation_id, turn_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_reply_to_message_id
  ON conversation_messages (reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_status_created_at
  ON conversation_messages (status, created_at DESC);

ALTER TABLE conversation_messages
  DROP COLUMN IF EXISTS content;
