package repository

import (
	"context"
	"sync"

	"tutor-server/internal/domain"
)

type ConversationRepository interface {
	List(ctx context.Context) ([]domain.Conversation, error)
	Create(ctx context.Context, conversation domain.Conversation) error
}

type InMemoryConversationRepository struct {
	mu    sync.RWMutex
	items []domain.Conversation
}

func NewInMemoryConversationRepository() *InMemoryConversationRepository {
	return &InMemoryConversationRepository{
		items: []domain.Conversation{
			{ID: "conv_demo_001", Title: "函数极限入门", SubjectID: "sub_math_high", UserID: "u_demo_001"},
		},
	}
}

func (r *InMemoryConversationRepository) List(_ context.Context) ([]domain.Conversation, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	cp := make([]domain.Conversation, 0, len(r.items))
	cp = append(cp, r.items...)
	return cp, nil
}

func (r *InMemoryConversationRepository) Create(_ context.Context, conversation domain.Conversation) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.items = append(r.items, conversation)
	return nil
}
