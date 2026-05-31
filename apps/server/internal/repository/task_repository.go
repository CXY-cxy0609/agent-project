package repository

import (
	"context"

	"tutor-server/internal/domain"
)

type TaskRepository interface {
	Create(ctx context.Context, task domain.Task) error
	GetByID(ctx context.Context, taskID string) (domain.Task, error)
}
