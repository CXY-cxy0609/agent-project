package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

type webLoginReq struct {
	Phone string `json:"phone"`
}

type webRegisterReq struct {
	Phone    string `json:"phone"`
	Username string `json:"username"`
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

		state.mu.RLock()
		user := state.users["mock-user-001"]
		state.mu.RUnlock()
		user.Phone = req.Phone
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

func Register() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req webRegisterReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid register body")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		user := webUser{
			ID:        "mock-user-001",
			Username:  req.Username,
			Phone:     req.Phone,
			Role:      "student",
			CreatedAt: now,
			UpdatedAt: now,
		}

		state.mu.Lock()
		state.users[user.ID] = user
		state.mu.Unlock()

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
		state.mu.RLock()
		user := state.users["mock-user-001"]
		state.mu.RUnlock()
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

		state.mu.Lock()
		user := state.users["mock-user-001"]
		if req.Username != "" {
			user.Username = req.Username
		}
		if req.Avatar != "" {
			user.Avatar = req.Avatar
		}
		user.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state.users[user.ID] = user
		state.mu.Unlock()

		response.OK(c, gin.H{"id": user.ID, "username": user.Username, "phone": user.Phone, "avatar": user.Avatar, "role": user.Role, "createdAt": user.CreatedAt, "updatedAt": user.UpdatedAt})
	}
}
