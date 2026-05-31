package http

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"tutor-server/internal/app"
	"tutor-server/internal/config"
	"tutor-server/internal/http/handlers"
	"tutor-server/internal/http/middleware"
)

func NewRouter(cfg config.Config, container *app.Container) *gin.Engine {
	if cfg.NodeEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	_ = r.SetTrustedProxies(nil)
	r.Use(middleware.RequestID())
	r.Use(middleware.AccessLog())
	r.Use(middleware.NewIdempotencyStore(5 * time.Minute).Middleware())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type", "x-internal-token"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "tutor-server",
			"status":  "ok",
		})
	})

	api := r.Group("/api")
	{
		api.GET("/health", handlers.Health(container.Health))

		auth := api.Group("/auth")
		{
			auth.POST("/login", handlers.Login(container.AuthService))
		}

		subjects := api.Group("/subjects")
		{
			subjects.GET("", handlers.ListSubjects(container.SubjectService))
		}

		conversations := api.Group("/conversations")
		{
			conversations.GET("", handlers.ListConversations(container.ConversationService))
			conversations.POST("", handlers.CreateConversation(container.ConversationService))
		}

		tasks := api.Group("/tasks")
		{
			tasks.POST("", handlers.CreateTask(container.TaskService))
			tasks.GET("/:id", handlers.GetTask(container.TaskService))
		}

		internal := api.Group("")
		internal.Use(middleware.InternalToken(cfg.Auth.InternalToken))
		{
			internal.POST("/learning-records", handlers.CreateLearningRecord(container.LearningRecordService))
			internal.GET("/learning-records", handlers.QueryLearningRecords(container.LearningRecordService))
		}
	}

	return r
}
