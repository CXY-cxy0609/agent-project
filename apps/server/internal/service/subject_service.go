package service

import (
	"context"

	"tutor-server/internal/domain"
	"tutor-server/internal/repository"
)

type SubjectService struct {
	repo repository.SubjectRepository
}

func NewSubjectService(repo repository.SubjectRepository) *SubjectService {
	return &SubjectService{repo: repo}
}

func (s *SubjectService) List(ctx context.Context) ([]domain.Subject, error) {
	return s.repo.List(ctx)
}
