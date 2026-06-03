-- Align learning_records.user_id with users.id (BIGINT UNSIGNED AUTO_INCREMENT).
-- Existing non-numeric or orphan records cannot satisfy the FK, so remove them
-- before changing the column type.

USE tutor_db;

SET @drop_learning_records_user_fk := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'learning_records'
        AND CONSTRAINT_NAME = 'fk_learning_records_user_id'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE learning_records DROP FOREIGN KEY fk_learning_records_user_id',
    'SELECT 1'
  )
);
PREPARE drop_learning_records_user_fk_stmt FROM @drop_learning_records_user_fk;
EXECUTE drop_learning_records_user_fk_stmt;
DEALLOCATE PREPARE drop_learning_records_user_fk_stmt;

DELETE FROM learning_records
WHERE user_id REGEXP '[^0-9]'
   OR CAST(user_id AS UNSIGNED) = 0;

DELETE lr
FROM learning_records lr
LEFT JOIN users u
  ON CAST(lr.user_id AS UNSIGNED) = u.id
WHERE u.id IS NULL;

ALTER TABLE learning_records
  MODIFY COLUMN user_id BIGINT UNSIGNED NOT NULL;

SET @add_learning_records_user_fk := (
  SELECT IF(
    NOT EXISTS (
      SELECT 1
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'learning_records'
        AND CONSTRAINT_NAME = 'fk_learning_records_user_id'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'ALTER TABLE learning_records ADD CONSTRAINT fk_learning_records_user_id FOREIGN KEY (user_id) REFERENCES users(id)',
    'SELECT 1'
  )
);
PREPARE add_learning_records_user_fk_stmt FROM @add_learning_records_user_fk;
EXECUTE add_learning_records_user_fk_stmt;
DEALLOCATE PREPARE add_learning_records_user_fk_stmt;
