package app

import (
	"fmt"
	"log"
	"strings"

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
	dbStore, dbErr := database.New(cfg.DB)
	if dbErr != nil {
		if strings.ToLower(strings.TrimSpace(cfg.DB.RepositoryMode)) == "sql" {
			return nil, fmt.Errorf("init database failed in sql mode: %w", dbErr)
		}
		log.Printf("database init failed in memory mode, continue without db: %v", dbErr)
	}

	if dbStore == nil {
		log.Printf("db store is nil, health check will report degraded")
	}

	redisStore := cache.New(cfg.Infra)
	if redisStore == nil {
		log.Printf("redis store is nil, health check will report down")
	}

	subjectRepo, conversationRepo, taskRepo, learningRepo := buildRepositories(cfg, dbStore)

	return &Container{
		Health:                health.NewService(dbStore, redisStore),
		AuthService:           service.NewAuthService(),
		SubjectService:        service.NewSubjectService(subjectRepo),
		ConversationService:   service.NewConversationService(conversationRepo),
		TaskService:           service.NewTaskService(taskRepo),
		LearningRecordService: service.NewLearningRecordService(learningRepo),
		dbStore:               dbStore,
		redisStore:            redisStore,
	}, nil
}

func buildRepositories(
	cfg config.Config,
	dbStore *database.Store,
) (
	repository.SubjectRepository,
	repository.ConversationRepository,
	repository.TaskRepository,
	repository.LearningRecordRepository,
) {
	mode := strings.ToLower(strings.TrimSpace(cfg.DB.RepositoryMode))
	if mode == "sql" && dbStore != nil {
		log.Printf("repository mode: sql")
		return repository.NewSQLSubjectRepository(dbStore),
			repository.NewSQLConversationRepository(dbStore),
			repository.NewSQLTaskRepository(dbStore),
			repository.NewSQLLearningRecordRepository(dbStore)
	}

	if mode == "sql" && dbStore == nil {
		log.Printf("repository mode fallback: sql requested but db unavailable, using memory")
	} else {
		log.Printf("repository mode: memory (set DB_REPOSITORY_MODE=sql to use database-backed repositories)")
	}
	return repository.NewInMemorySubjectRepository(),
		repository.NewInMemoryConversationRepository(),
		repository.NewInMemoryTaskRepository(),
		repository.NewInMemoryLearningRecordRepository()
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
