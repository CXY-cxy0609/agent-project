CREATE TABLE IF NOT EXISTS conversation_message_attachments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attachment_id VARCHAR(80) NOT NULL UNIQUE,
  message_id VARCHAR(80) NOT NULL,
  conversation_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128),
  type VARCHAR(24) NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  url VARCHAR(1024) NOT NULL,
  object_key VARCHAR(512),
  thumbnail_url VARCHAR(1024),
  hash VARCHAR(128),
  status VARCHAR(16) NOT NULL DEFAULT 'done',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_conversation_message_attachments_message_id FOREIGN KEY (message_id) REFERENCES conversation_messages(message_id),
  CONSTRAINT fk_conversation_message_attachments_conversation_id FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_message_attachments_message_id
  ON conversation_message_attachments (message_id);
CREATE INDEX IF NOT EXISTS idx_conversation_message_attachments_conversation_id
  ON conversation_message_attachments (conversation_id);
