package repository

import (
	"context"
	"sync"

	"tutor-server/internal/domain"
)

type LearningRecordFilter struct {
	Subject string
	Chapter string
	Limit   int
}

type LearningRecordRepository interface {
	Create(ctx context.Context, record domain.LearningRecord) error
	Query(ctx context.Context, userID string, filter LearningRecordFilter) ([]domain.LearningRecord, error)
}

type InMemoryLearningRecordRepository struct {
	mu    sync.RWMutex
	items []domain.LearningRecord
}

func NewInMemoryLearningRecordRepository() *InMemoryLearningRecordRepository {
	return &InMemoryLearningRecordRepository{items: make([]domain.LearningRecord, 0, 32)}
}

func (r *InMemoryLearningRecordRepository) Create(_ context.Context, record domain.LearningRecord) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items = append(r.items, record)
	return nil
}

func (r *InMemoryLearningRecordRepository) Query(
	_ context.Context,
	userID string,
	filter LearningRecordFilter,
) ([]domain.LearningRecord, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	limit := filter.Limit
	if limit <= 0 {
		limit = 30
	}

	result := make([]domain.LearningRecord, 0, limit)
	for i := len(r.items) - 1; i >= 0; i-- {
		item := r.items[i]
		if item.UserID != userID {
			continue
		}
		if filter.Subject != "" && item.Subject != filter.Subject {
			continue
		}
		if filter.Chapter != "" && item.Chapter != filter.Chapter {
			continue
		}
		result = append(result, item)
		if len(result) >= limit {
			break
		}
	}
	return result, nil
}
