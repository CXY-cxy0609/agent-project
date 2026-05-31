package database

import (
	"context"
	"fmt"
	"time"
)

func (s *Store) AutoMigrate(ctx context.Context) error {
	if s == nil || s.db == nil {
		return fmt.Errorf("db store is nil")
	}

	statements := []string{
		`CREATE TABLE IF NOT EXISTS subjects (
			id VARCHAR(64) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			code VARCHAR(64) NOT NULL,
			education_stage VARCHAR(32) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS conversations (
			id VARCHAR(64) PRIMARY KEY,
			title VARCHAR(255) NOT NULL,
			subject_id VARCHAR(64) NOT NULL,
			user_id VARCHAR(64) NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS tasks (
			id VARCHAR(80) PRIMARY KEY,
			type VARCHAR(64) NOT NULL,
			status VARCHAR(32) NOT NULL,
			trace_id VARCHAR(80) NOT NULL,
			created_at TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS learning_records (
			user_id VARCHAR(64) NOT NULL,
			session_id VARCHAR(64) NOT NULL,
			subject VARCHAR(64) NOT NULL,
			chapter VARCHAR(128) DEFAULT '',
			knowledge_point VARCHAR(255) NOT NULL,
			difficulty VARCHAR(16) DEFAULT 'medium',
			asked_at TIMESTAMP NOT NULL
		)`,
	}

	mCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	for _, stmt := range statements {
		if _, err := s.db.ExecContext(mCtx, stmt); err != nil {
			return fmt.Errorf("migrate failed: %w", err)
		}
	}

	return nil
}
