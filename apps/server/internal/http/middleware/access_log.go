package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func AccessLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		durationMs := time.Since(start).Milliseconds()
		log.Printf(
			"request_id=%s method=%s path=%s status=%d duration_ms=%d ip=%s",
			GetRequestID(c),
			c.Request.Method,
			c.FullPath(),
			c.Writer.Status(),
			durationMs,
			c.ClientIP(),
		)
	}
}
