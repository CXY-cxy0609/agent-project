package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/middleware"
)

func OK(c *gin.Context, data gin.H) {
	payload := gin.H{
		"success":    true,
		"request_id": middleware.GetRequestID(c),
		"data":       data,
	}
	c.JSON(http.StatusOK, payload)
}

func Created(c *gin.Context, data gin.H) {
	payload := gin.H{
		"success":    true,
		"request_id": middleware.GetRequestID(c),
		"data":       data,
	}
	c.JSON(http.StatusCreated, payload)
}

func Error(c *gin.Context, code int, errCode, message string) {
	c.JSON(code, gin.H{
		"success":    false,
		"request_id": middleware.GetRequestID(c),
		"error": gin.H{
			"code":    errCode,
			"message": message,
		},
	})
}
