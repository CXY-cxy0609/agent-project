package cache

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"

	"tutor-server/internal/config"
)

type RedisStore struct {
	client *redis.Client
}

func New(cfg config.InfraConfig) *RedisStore {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Username: cfg.RedisUsername,
		Password: cfg.RedisPwd,
		DB:       0,
	})
	return &RedisStore{client: client}
}

func (s *RedisStore) Check(ctx context.Context) error {
	if s == nil || s.client == nil {
		return fmt.Errorf("redis store is nil")
	}
	return s.client.Ping(ctx).Err()
}

func (s *RedisStore) Close() error {
	if s == nil || s.client == nil {
		return nil
	}
	return s.client.Close()
}
