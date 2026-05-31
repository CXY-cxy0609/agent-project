package service

import (
	"context"

	"tutor-server/internal/domain"
)

type AuthService struct{}

type LoginResult struct {
	UserID       string          `json:"user_id"`
	Phone        string          `json:"phone"`
	Role         domain.UserRole `json:"role"`
	DisplayName  string          `json:"display_name"`
	AccessToken  string          `json:"access_token"`
	RefreshToken string          `json:"refresh_token"`
	ExpiresIn    int             `json:"expires_in"`
}

func NewAuthService() *AuthService {
	return &AuthService{}
}

func (s *AuthService) Login(_ context.Context, phone, _ string) LoginResult {
	role := domain.RoleStudent
	if phone == "teacher" {
		role = domain.RoleTeacher
	}
	if phone == "admin" {
		role = domain.RoleAdmin
	}

	return LoginResult{
		UserID:       "u_demo_001",
		Phone:        phone,
		Role:         role,
		DisplayName:  "Demo User",
		AccessToken:  "demo_access_token",
		RefreshToken: "demo_refresh_token",
		ExpiresIn:    3600,
	}
}
