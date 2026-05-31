package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"tutor-server/internal/domain"
	"tutor-server/internal/repository"
)

type TaskService struct {
	repo repository.TaskRepository
}

func NewTaskService(repo repository.TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

func (s *TaskService) Create(ctx context.Context, taskType string, traceID string) (domain.Task, error) {
	task := domain.Task{
		ID:        "task_" + uuid.NewString(),
		Type:      taskType,
		Status:    "queued",
		TraceID:   traceID,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.repo.Create(ctx, task); err != nil {
		return domain.Task{}, err
	}
	return task, nil
}

func (s *TaskService) GetByID(ctx context.Context, taskID string) (domain.Task, error) {
	task, err := s.repo.GetByID(ctx, taskID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return domain.Task{}, repository.ErrNotFound
		}
		return domain.Task{}, err
	}
	return task, nil
}
