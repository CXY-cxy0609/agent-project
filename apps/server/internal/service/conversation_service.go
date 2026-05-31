package service

import (
	"context"

	"github.com/google/uuid"

	"tutor-server/internal/domain"
	"tutor-server/internal/repository"
)

type ConversationService struct {
	repo repository.ConversationRepository
}

func NewConversationService(repo repository.ConversationRepository) *ConversationService {
	return &ConversationService{repo: repo}
}

func (s *ConversationService) List(ctx context.Context) ([]domain.Conversation, error) {
	return s.repo.List(ctx)
}

func (s *ConversationService) Create(
	ctx context.Context,
	title string,
	subjectID string,
	userID string,
) (domain.Conversation, error) {
	conversation := domain.Conversation{
		ID:        uuid.NewString(),
		Title:     title,
		SubjectID: subjectID,
		UserID:    userID,
	}
	if err := s.repo.Create(ctx, conversation); err != nil {
		return domain.Conversation{}, err
	}
	return conversation, nil
}
