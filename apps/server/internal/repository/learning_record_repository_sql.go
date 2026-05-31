package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"tutor-server/internal/domain"
	"tutor-server/internal/infra/database"
)

type SQLLearningRecordRepository struct {
	db     *sql.DB
	driver string
}

func NewSQLLearningRecordRepository(store *database.Store) *SQLLearningRecordRepository {
	return &SQLLearningRecordRepository{
		db:     store.SQLDB(),
		driver: store.Driver(),
	}
}

func (r *SQLLearningRecordRepository) Create(ctx context.Context, record domain.LearningRecord) error {
	query := `INSERT INTO learning_records
		(user_id, session_id, subject, chapter, knowledge_point, difficulty, asked_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	args := []any{
		record.UserID,
		record.SessionID,
		record.Subject,
		record.Chapter,
		record.KnowledgePoint,
		record.Difficulty,
		record.AskedAt,
	}
	if r.driver == "pgx" {
		query = `INSERT INTO learning_records
			(user_id, session_id, subject, chapter, knowledge_point, difficulty, asked_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`
	}
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *SQLLearningRecordRepository) Query(
	ctx context.Context,
	userID string,
	filter LearningRecordFilter,
) ([]domain.LearningRecord, error) {
	where := []string{"user_id = ?"}
	args := []any{userID}

	if filter.Subject != "" {
		where = append(where, "subject = ?")
		args = append(args, filter.Subject)
	}
	if filter.Chapter != "" {
		where = append(where, "chapter = ?")
		args = append(args, filter.Chapter)
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 30
	}

	query := fmt.Sprintf(`SELECT user_id, session_id, subject, chapter, knowledge_point, difficulty, asked_at
		FROM learning_records
		WHERE %s
		ORDER BY asked_at DESC
		LIMIT ?`, strings.Join(where, " AND "))
	args = append(args, limit)

	if r.driver == "pgx" {
		idx := 1
		replacer := strings.NewReplacer("?", "$1")
		// Build deterministic placeholders for pgx.
		parts := make([]string, 0, len(where))
		argsPg := make([]any, 0, len(args))
		for _, cond := range where {
			parts = append(parts, strings.Replace(cond, "?", fmt.Sprintf("$%d", idx), 1))
			idx++
		}
		query = fmt.Sprintf(`SELECT user_id, session_id, subject, chapter, knowledge_point, difficulty, asked_at
			FROM learning_records
			WHERE %s
			ORDER BY asked_at DESC
			LIMIT $%d`, strings.Join(parts, " AND "), idx)
		_ = replacer
		argsPg = append(argsPg, args[:len(args)-1]...)
		argsPg = append(argsPg, limit)
		args = argsPg
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.LearningRecord, 0, limit)
	for rows.Next() {
		var item domain.LearningRecord
		if err := rows.Scan(
			&item.UserID,
			&item.SessionID,
			&item.Subject,
			&item.Chapter,
			&item.KnowledgePoint,
			&item.Difficulty,
			&item.AskedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}
