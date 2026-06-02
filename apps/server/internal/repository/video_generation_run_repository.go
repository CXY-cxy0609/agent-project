package repository

import (
	"context"

	"tutor-server/internal/domain"
)

type VideoGenerationRunRepository interface {
	Upsert(ctx context.Context, run domain.VideoGenerationRun) error
	GetByRunID(ctx context.Context, runID string) (domain.VideoGenerationRun, error)
}
