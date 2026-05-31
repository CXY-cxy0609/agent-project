package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
	"tutor-server/internal/service"
)

type loginReq struct {
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

func Login(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid login body")
			return
		}

		loginResult := authService.Login(c.Request.Context(), req.Phone, req.Password)

		response.OK(c, gin.H{
			"user": gin.H{
				"id":          loginResult.UserID,
				"phone":       loginResult.Phone,
				"role":        loginResult.Role,
				"displayName": loginResult.DisplayName,
			},
			"token": gin.H{
				"access_token":  loginResult.AccessToken,
				"refresh_token": loginResult.RefreshToken,
				"expires_in":    loginResult.ExpiresIn,
			},
			"issued_at": time.Now().UTC().Format(time.RFC3339),
		})
	}
}
