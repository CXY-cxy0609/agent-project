package health

import (
	"context"
	"time"
)

type Checker interface {
	Check(ctx context.Context) error
}

type Probe struct {
	Name       string `json:"name"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
	DurationMs int64  `json:"duration_ms"`
}

type Service struct {
	db    Checker
	redis Checker
}

func NewService(db Checker, redis Checker) *Service {
	return &Service{
		db:    db,
		redis: redis,
	}
}

func (s *Service) CheckAll(ctx context.Context) ([]Probe, bool) {
	probes := make([]Probe, 0, 2)
	healthy := true

	dbProbe, dbOK := runProbe(ctx, "database", s.db)
	redisProbe, redisOK := runProbe(ctx, "redis", s.redis)
	probes = append(probes, dbProbe, redisProbe)

	if !dbOK || !redisOK {
		healthy = false
	}

	return probes, healthy
}

func runProbe(ctx context.Context, name string, checker Checker) (Probe, bool) {
	start := time.Now()

	if checker == nil {
		return Probe{
			Name:       name,
			Status:     "unknown",
			Error:      "checker not configured",
			DurationMs: time.Since(start).Milliseconds(),
		}, false
	}

	checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	err := checker.Check(checkCtx)
	if err != nil {
		return Probe{
			Name:       name,
			Status:     "down",
			Error:      err.Error(),
			DurationMs: time.Since(start).Milliseconds(),
		}, false
	}

	return Probe{
		Name:       name,
		Status:     "up",
		DurationMs: time.Since(start).Milliseconds(),
	}, true
}
