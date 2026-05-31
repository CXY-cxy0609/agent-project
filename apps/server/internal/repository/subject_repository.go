package repository

import (
	"context"

	"tutor-server/internal/domain"
)

type SubjectRepository interface {
	List(ctx context.Context) ([]domain.Subject, error)
}
