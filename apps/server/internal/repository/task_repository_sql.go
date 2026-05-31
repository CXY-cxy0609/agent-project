package repository

import (
	"context"
	"database/sql"
	"errors"

	"tutor-server/internal/domain"
	"tutor-server/internal/infra/database"
)

type SQLTaskRepository struct {
	db     *sql.DB
	driver string
}

func NewSQLTaskRepository(store *database.Store) *SQLTaskRepository {
	return &SQLTaskRepository{
		db:     store.SQLDB(),
		driver: store.Driver(),
	}
}

func (r *SQLTaskRepository) Create(ctx context.Context, task domain.Task) error {
	query := `INSERT INTO tasks (task_id, type, status, trace_id, created_at) VALUES (?, ?, ?, ?, ?)`
	args := []any{task.ID, task.Type, task.Status, task.TraceID, task.CreatedAt}
	if r.driver == "pgx" {
		query = `INSERT INTO tasks (task_id, type, status, trace_id, created_at) VALUES ($1, $2, $3, $4, $5)`
	}
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *SQLTaskRepository) GetByID(ctx context.Context, taskID string) (domain.Task, error) {
	query := `SELECT task_id, type, status, trace_id, created_at FROM tasks WHERE task_id = ?`
	arg := []any{taskID}
	if r.driver == "pgx" {
		query = `SELECT task_id, type, status, trace_id, created_at FROM tasks WHERE task_id = $1`
	}

	var task domain.Task
	err := r.db.QueryRowContext(ctx, query, arg...).Scan(
		&task.ID,
		&task.Type,
		&task.Status,
		&task.TraceID,
		&task.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Task{}, ErrNotFound
		}
		return domain.Task{}, err
	}
	return task, nil
}
