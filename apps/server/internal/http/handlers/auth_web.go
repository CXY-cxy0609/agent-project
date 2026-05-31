package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
	"tutor-server/internal/service"
)

type webLoginReq struct {
	Phone string `json:"phone"`
}

type webRegisterReq struct {
	Phone           string `json:"phone"`
	Username        string `json:"username"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

type webUpdateProfileReq struct {
	Username string `json:"username"`
	Avatar   string `json:"avatar"`
}

func loginPayload(user webUser) gin.H {
	return gin.H{
		"user": user,
		"token": gin.H{
			"accessToken":  "demo_access_token",
			"refreshToken": "demo_refresh_token",
			"expiresIn":    3600,
		},
	}
}

func LoginByPassword() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req webLoginReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid login body")
			return
		}

		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		user, err := fetchOrCreateUserByPhone(c, db, req.Phone)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "LOGIN_FAILED", "login failed")
			return
		}
		response.OK(c, loginPayload(user))
	}
}

func LoginByCode() gin.HandlerFunc {
	return LoginByPassword()
}

func SendCode() gin.HandlerFunc {
	return func(c *gin.Context) {
		response.OK(c, gin.H{"sent": true})
	}
}

func Register(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req webRegisterReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid register body")
			return
		}

		if strings.TrimSpace(req.Password) == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_PASSWORD", "password is required")
			return
		}
		if req.ConfirmPassword != "" && req.Password != req.ConfirmPassword {
			response.Error(c, http.StatusBadRequest, "PASSWORD_MISMATCH", "password and confirmPassword do not match")
			return
		}

		registerResult, err := authService.Register(c.Request.Context(), req.Phone, req.Username, req.Password)
		if err != nil {
			if errors.Is(err, service.ErrPhoneAlreadyExists) {
				response.Error(c, http.StatusConflict, "PHONE_ALREADY_EXISTS", "phone already registered")
				return
			}
			if errors.Is(err, service.ErrInvalidPassword) {
				response.Error(c, http.StatusBadRequest, "INVALID_PASSWORD", "password is required")
				return
			}
			response.Error(c, http.StatusInternalServerError, "REGISTER_FAILED", "register failed")
			return
		}

		user := webUser{
			ID:        registerResult.UserID,
			Username:  registerResult.DisplayName,
			Phone:     registerResult.Phone,
			Role:      string(registerResult.Role),
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		}

		response.OK(c, loginPayload(user))
	}
}

func UpdatePassword() gin.HandlerFunc {
	return func(c *gin.Context) {
		response.OK(c, gin.H{"updated": true})
	}
}

func GetProfile() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		user, err := fetchLatestUser(c, db)
		if err != nil {
			if err == sql.ErrNoRows {
				response.Error(c, http.StatusNotFound, "USER_NOT_FOUND", "user not found")
				return
			}
			response.Error(c, http.StatusInternalServerError, "PROFILE_QUERY_FAILED", "failed to query profile")
			return
		}
		response.OK(c, gin.H{"id": user.ID, "username": user.Username, "phone": user.Phone, "avatar": user.Avatar, "role": user.Role, "createdAt": user.CreatedAt, "updatedAt": user.UpdatedAt})
	}
}

func UpdateProfile() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req webUpdateProfileReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid profile body")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		user, err := fetchLatestUser(c, db)
		if err != nil {
			response.Error(c, http.StatusNotFound, "USER_NOT_FOUND", "user not found")
			return
		}
		if req.Username != "" {
			user.Username = req.Username
		}
		if req.Avatar != "" {
			user.Avatar = req.Avatar
		}
		user.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		_, err = db.ExecContext(
			c,
			`UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?`,
			user.Username,
			user.ID,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "PROFILE_UPDATE_FAILED", "failed to update profile")
			return
		}

		response.OK(c, gin.H{"id": user.ID, "username": user.Username, "phone": user.Phone, "avatar": user.Avatar, "role": user.Role, "createdAt": user.CreatedAt, "updatedAt": user.UpdatedAt})
	}
}

func fetchLatestUser(c *gin.Context, db *sql.DB) (webUser, error) {
	var user webUser
	var createdAt, updatedAt time.Time
	err := db.QueryRowContext(
		c,
		`SELECT id, username, phone, role, created_at, updated_at
		FROM users
		ORDER BY id DESC
		LIMIT 1`,
	).Scan(&user.ID, &user.Username, &user.Phone, &user.Role, &createdAt, &updatedAt)
	if err != nil {
		return webUser{}, err
	}
	user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	user.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	return user, nil
}

func fetchOrCreateUserByPhone(c *gin.Context, db *sql.DB, phone string) (webUser, error) {
	trimmed := strings.TrimSpace(phone)
	if trimmed == "" {
		return fetchLatestUser(c, db)
	}

	var user webUser
	var createdAt, updatedAt time.Time
	err := db.QueryRowContext(
		c,
		`SELECT id, username, phone, role, created_at, updated_at
		FROM users
		WHERE phone = ?
		ORDER BY id DESC
		LIMIT 1`,
		trimmed,
	).Scan(&user.ID, &user.Username, &user.Phone, &user.Role, &createdAt, &updatedAt)
	if err == nil {
		user.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		user.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		return user, nil
	}
	if err != sql.ErrNoRows {
		return webUser{}, err
	}

	now := time.Now().UTC()
	result, err := db.ExecContext(
		c,
		`INSERT INTO users (username, phone, password_hash, role, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, 1, ?, ?)`,
		trimmed,
		trimmed,
		"not_set",
		"student",
		now,
		now,
	)
	if err != nil {
		return webUser{}, err
	}
	insertedID, err := result.LastInsertId()
	if err != nil {
		return webUser{}, err
	}
	userID := strconv.FormatInt(insertedID, 10)
	return webUser{
		ID:        userID,
		Username:  trimmed,
		Phone:     trimmed,
		Role:      "student",
		CreatedAt: now.Format(time.RFC3339),
		UpdatedAt: now.Format(time.RFC3339),
	}, nil
}
