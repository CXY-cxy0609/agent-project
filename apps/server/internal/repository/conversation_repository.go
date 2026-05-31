package repository

import (
	"context"

	"tutor-server/internal/domain"
)

type ConversationRepository interface {
	List(ctx context.Context) ([]domain.Conversation, error)
	Create(ctx context.Context, conversation domain.Conversation) error
}
