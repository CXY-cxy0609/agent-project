package app

import (
	"fmt"
	"log"

	"tutor-server/internal/config"
	"tutor-server/internal/health"
	"tutor-server/internal/infra/cache"
	"tutor-server/internal/infra/database"
	"tutor-server/internal/repository"
	"tutor-server/internal/service"
)

type Container struct {
	Health                *health.Service
	AuthService           *service.AuthService
	SubjectService        *service.SubjectService
	ConversationService   *service.ConversationService
	TaskService           *service.TaskService
	LearningRecordService *service.LearningRecordService

	dbStore    *database.Store
	redisStore *cache.RedisStore
}

func Build(cfg config.Config) (*Container, error) {
	dbStore, err := database.New(cfg.DB)
	if err != nil {
		return nil, fmt.Errorf("init database failed: %w", err)
	}
	if err := ensureRuntimeSchema(dbStore); err != nil {
		return nil, fmt.Errorf("ensure runtime schema failed: %w", err)
	}

	redisStore := cache.New(cfg.Infra)
	if redisStore == nil {
		log.Printf("redis store is nil, health check will report down")
	}

	userRepo, subjectRepo, conversationRepo, taskRepo, learningRepo := buildRepositories(dbStore)

	return &Container{
		Health:                health.NewService(dbStore, redisStore),
		AuthService:           service.NewAuthService(userRepo),
		SubjectService:        service.NewSubjectService(subjectRepo),
		ConversationService:   service.NewConversationService(conversationRepo),
		TaskService:           service.NewTaskService(taskRepo),
		LearningRecordService: service.NewLearningRecordService(learningRepo),
		dbStore:               dbStore,
		redisStore:            redisStore,
	}, nil
}

func buildRepositories(
	dbStore *database.Store,
) (
	repository.UserRepository,
	repository.SubjectRepository,
	repository.ConversationRepository,
	repository.TaskRepository,
	repository.LearningRecordRepository,
) {
	log.Printf("repository mode: sql")
	return repository.NewSQLUserRepository(dbStore),
		repository.NewSQLSubjectRepository(dbStore),
		repository.NewSQLConversationRepository(dbStore),
		repository.NewSQLTaskRepository(dbStore),
		repository.NewSQLLearningRecordRepository(dbStore)
}

func (c *Container) Close() {
	if c == nil {
		return
	}
	if c.dbStore != nil {
		_ = c.dbStore.Close()
	}
	if c.redisStore != nil {
		_ = c.redisStore.Close()
	}
}

func (c *Container) DBStore() *database.Store {
	if c == nil {
		return nil
	}
	return c.dbStore
}
