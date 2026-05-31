package repository

import (
	"context"
	"time"
)

type User struct {
	ID           string
	Username     string
	Phone        string
	PasswordHash string
	Role         string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type UserRepository interface {
	Create(ctx context.Context, user User) (User, error)
}
