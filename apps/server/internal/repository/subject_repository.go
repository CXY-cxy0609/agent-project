package repository

import (
	"context"
	"sync"

	"tutor-server/internal/domain"
)

type SubjectRepository interface {
	List(ctx context.Context) ([]domain.Subject, error)
}

type InMemorySubjectRepository struct {
	mu    sync.RWMutex
	items []domain.Subject
}

func NewInMemorySubjectRepository() *InMemorySubjectRepository {
	return &InMemorySubjectRepository{
		items: []domain.Subject{
			{ID: "sub_math_primary", Name: "小学数学", Code: "MATH_P", EducationStage: "primary"},
			{ID: "sub_math_high", Name: "高中数学", Code: "MATH_H", EducationStage: "high"},
			{ID: "sub_cs_college", Name: "大学计算机基础", Code: "CS_C", EducationStage: "college"},
		},
	}
}

func (r *InMemorySubjectRepository) List(_ context.Context) ([]domain.Subject, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cp := make([]domain.Subject, 0, len(r.items))
	cp = append(cp, r.items...)
	return cp, nil
}
