package repository

import (
	"context"
	"sync"

	"tutor-server/internal/domain"
)

type TaskRepository interface {
	Create(ctx context.Context, task domain.Task) error
	GetByID(ctx context.Context, taskID string) (domain.Task, error)
}

type InMemoryTaskRepository struct {
	mu    sync.Mutex
	items []domain.Task
}

func NewInMemoryTaskRepository() *InMemoryTaskRepository {
	return &InMemoryTaskRepository{items: make([]domain.Task, 0, 16)}
}

func (r *InMemoryTaskRepository) Create(_ context.Context, task domain.Task) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items = append(r.items, task)
	return nil
}

func (r *InMemoryTaskRepository) GetByID(_ context.Context, taskID string) (domain.Task, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, item := range r.items {
		if item.ID == taskID {
			return item, nil
		}
	}
	return domain.Task{}, ErrNotFound
}
