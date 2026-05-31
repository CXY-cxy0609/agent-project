package service

import (
	"context"
	"time"

	"tutor-server/internal/domain"
	"tutor-server/internal/repository"
)

type LearningRecordService struct {
	repo repository.LearningRecordRepository
}

func NewLearningRecordService(repo repository.LearningRecordRepository) *LearningRecordService {
	return &LearningRecordService{repo: repo}
}

func (s *LearningRecordService) Write(ctx context.Context, record domain.LearningRecord) error {
	if record.AskedAt == "" {
		record.AskedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if record.Difficulty == "" {
		record.Difficulty = "medium"
	}
	return s.repo.Create(ctx, record)
}

func (s *LearningRecordService) Query(
	ctx context.Context,
	userID string,
	filter repository.LearningRecordFilter,
) ([]domain.LearningRecord, error) {
	return s.repo.Query(ctx, userID, filter)
}
