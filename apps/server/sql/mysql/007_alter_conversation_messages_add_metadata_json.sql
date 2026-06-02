ALTER TABLE conversation_messages
  ADD COLUMN metadata_json JSON DEFAULT NULL AFTER token_usage;