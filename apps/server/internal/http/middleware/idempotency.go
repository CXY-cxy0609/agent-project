package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type idemEntry struct {
	expiresAt time.Time
}

type IdempotencyStore struct {
	ttl   time.Duration
	mu    sync.Mutex
	items map[string]idemEntry
}

func NewIdempotencyStore(ttl time.Duration) *IdempotencyStore {
	return &IdempotencyStore{
		ttl:   ttl,
		items: make(map[string]idemEntry),
	}
}

func (s *IdempotencyStore) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodPost && c.Request.Method != http.MethodPut {
			c.Next()
			return
		}

		key := c.GetHeader("idempotency-key")
		if key == "" {
			c.Next()
			return
		}

		now := time.Now()
		s.mu.Lock()
		defer s.mu.Unlock()

		for k, v := range s.items {
			if now.After(v.expiresAt) {
				delete(s.items, k)
			}
		}

		if _, exists := s.items[key]; exists {
			c.AbortWithStatusJSON(http.StatusConflict, gin.H{
				"code":       "DUPLICATE_REQUEST",
				"message":    "duplicate request with same idempotency-key",
				"request_id": GetRequestID(c),
			})
			return
		}

		s.items[key] = idemEntry{expiresAt: now.Add(s.ttl)}
		c.Next()
	}
}
