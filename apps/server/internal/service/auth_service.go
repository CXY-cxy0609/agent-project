package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"

	"tutor-server/internal/domain"
	"tutor-server/internal/repository"
)

var ErrPhoneAlreadyExists = errors.New("phone already exists")
var ErrInvalidPassword = errors.New("invalid password")

type AuthService struct {
	users repository.UserRepository
}

type LoginResult struct {
	UserID       string          `json:"user_id"`
	Phone        string          `json:"phone"`
	Role         domain.UserRole `json:"role"`
	DisplayName  string          `json:"display_name"`
	AccessToken  string          `json:"access_token"`
	RefreshToken string          `json:"refresh_token"`
	ExpiresIn    int             `json:"expires_in"`
}

func NewAuthService(users repository.UserRepository) *AuthService {
	return &AuthService{users: users}
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

func (s *AuthService) Register(ctx context.Context, phone, username, password string) (LoginResult, error) {
	phone = strings.TrimSpace(phone)
	username = strings.TrimSpace(username)
	if username == "" {
		username = phone
	}
	password = strings.TrimSpace(password)
	if password == "" {
		return LoginResult{}, ErrInvalidPassword
	}

	user := repository.User{
		Username:     username,
		Phone:        phone,
		PasswordHash: hashPassword(password),
		Role:         string(domain.RoleStudent),
	}

	if s.users != nil {
		created, err := s.users.Create(ctx, user)
		if err != nil {
			if errors.Is(err, repository.ErrAlreadyExists) {
				return LoginResult{}, ErrPhoneAlreadyExists
			}
			return LoginResult{}, err
		}
		user = created
	}

	return LoginResult{
		UserID:       user.ID,
		Phone:        user.Phone,
		Role:         domain.RoleStudent,
		DisplayName:  user.Username,
		AccessToken:  "demo_access_token",
		RefreshToken: "demo_refresh_token",
		ExpiresIn:    3600,
	}, nil
}

func hashPassword(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return "sha256:" + hex.EncodeToString(sum[:])
}
