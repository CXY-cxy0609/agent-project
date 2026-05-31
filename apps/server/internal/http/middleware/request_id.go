package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const requestIDKey = "request_id"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("x-request-id")
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Set(requestIDKey, requestID)
		c.Header("x-request-id", requestID)
		c.Next()
	}
}

func GetRequestID(c *gin.Context) string {
	val, ok := c.Get(requestIDKey)
	if !ok {
		return ""
	}
	id, _ := val.(string)
	return id
}
