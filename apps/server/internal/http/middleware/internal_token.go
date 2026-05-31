package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func InternalToken(expected string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if expected == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"success":    false,
				"request_id": GetRequestID(c),
				"error": gin.H{
					"code":    "INTERNAL_TOKEN_NOT_CONFIGURED",
					"message": "internal token not configured",
				},
			})
			c.Abort()
			return
		}
		token := c.GetHeader("x-internal-token")
		if token == "" || token != expected {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success":    false,
				"request_id": GetRequestID(c),
				"error": gin.H{
					"code":    "UNAUTHORIZED_INTERNAL_CALL",
					"message": "invalid internal token",
				},
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
