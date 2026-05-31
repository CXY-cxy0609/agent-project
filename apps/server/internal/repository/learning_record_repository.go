package repository

import (
	"context"

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
