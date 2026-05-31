package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/health"
	"tutor-server/internal/http/middleware"
)

func Health(healthService *health.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		probes, healthy := healthService.CheckAll(c.Request.Context())

		status := "ok"
		if !healthy {
			status = "degraded"
		}

		payload := gin.H{
			"success":    healthy,
			"request_id": middleware.GetRequestID(c),
			"data": gin.H{
				"status":       status,
				"service":      "tutor-server",
				"dependencies": probes,
				"timestamp":    time.Now().UTC().Format(time.RFC3339),
			},
		}

		if !healthy {
			c.JSON(http.StatusServiceUnavailable, payload)
			return
		}

		c.JSON(http.StatusOK, payload)
	}
}
