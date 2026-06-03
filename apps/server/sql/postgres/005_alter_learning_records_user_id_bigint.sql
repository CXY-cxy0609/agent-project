-- Align learning_records.user_id with users.id (BIGINT identity).
-- Existing non-numeric or orphan records cannot satisfy the FK, so remove them
-- before changing the column type.

ALTER TABLE learning_records
  DROP CONSTRAINT IF EXISTS fk_learning_records_user_id;

DELETE FROM learning_records
WHERE user_id !~ '^[1-9][0-9]*$';

DELETE FROM learning_records lr
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.id = lr.user_id::BIGINT
);

ALTER TABLE learning_records
  ALTER COLUMN user_id TYPE BIGINT USING user_id::BIGINT,
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE learning_records
  ADD CONSTRAINT fk_learning_records_user_id FOREIGN KEY (user_id) REFERENCES users(id);
