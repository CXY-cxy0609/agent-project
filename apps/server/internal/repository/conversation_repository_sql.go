package repository

import (
	"context"
	"database/sql"

	"tutor-server/internal/domain"
	"tutor-server/internal/infra/database"
)

type SQLConversationRepository struct {
	db     *sql.DB
	driver string
}

func NewSQLConversationRepository(store *database.Store) *SQLConversationRepository {
	return &SQLConversationRepository{
		db:     store.SQLDB(),
		driver: store.Driver(),
	}
}

func (r *SQLConversationRepository) List(ctx context.Context) ([]domain.Conversation, error) {
	rows, err := r.db.QueryContext(
		ctx,
		`SELECT id, title, subject_id, user_id FROM conversations ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]domain.Conversation, 0, 16)
	for rows.Next() {
		var c domain.Conversation
		if err := rows.Scan(&c.ID, &c.Title, &c.SubjectID, &c.UserID); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (r *SQLConversationRepository) Create(ctx context.Context, conversation domain.Conversation) error {
	query := `INSERT INTO conversations (id, title, subject_id, user_id) VALUES (?, ?, ?, ?)`
	args := []any{conversation.ID, conversation.Title, conversation.SubjectID, conversation.UserID}
	if r.driver == "pgx" {
		query = `INSERT INTO conversations (id, title, subject_id, user_id) VALUES ($1, $2, $3, $4)`
	}
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}
