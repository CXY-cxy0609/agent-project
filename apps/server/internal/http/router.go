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
			auth.POST("/login/password", handlers.LoginByPassword())
			auth.POST("/login/code", handlers.LoginByCode())
			auth.POST("/send-code", handlers.SendCode())
			auth.POST("/register", handlers.Register())
			auth.PUT("/password", handlers.UpdatePassword())
			auth.GET("/profile", handlers.GetProfile())
			auth.PUT("/profile", handlers.UpdateProfile())
		}

		subjects := api.Group("/subjects")
		{
			subjects.GET("", handlers.ListMySubjects())
			subjects.GET("/search", handlers.SearchSubjects())
			subjects.POST("", handlers.CreateSubject())
			subjects.PUT("/:id", handlers.UpdateSubject())
			subjects.DELETE("/:id", handlers.DeleteSubject())
			subjects.GET("/my", handlers.ListMySubjects())
			subjects.POST("/my", handlers.AddMySubject())
			subjects.DELETE("/my/:id", handlers.RemoveMySubject())
			subjects.GET("/:id/outline", handlers.GetSubjectOutline())
			subjects.PUT("/:id/outline", handlers.UpdateSubjectOutline())
		}

		conversations := api.Group("/conversations")
		{
			conversations.GET("", handlers.ListConversationsWeb())
			conversations.POST("", handlers.CreateConversationWeb())
			conversations.GET("/:id", handlers.GetConversationWeb())
			conversations.DELETE("/:id", handlers.DeleteConversationWeb())
			conversations.GET("/:id/messages", handlers.ListConversationMessages())
			conversations.POST("/:id/messages", handlers.CreateConversationMessage())
		}

		analytics := api.Group("/analytics")
		{
			analytics.GET("/:subjectId", handlers.GetAnalytics())
			analytics.POST("/:subjectId/summary", handlers.GenerateAnalyticsSummary())
		}

		knowledge := api.Group("/knowledge-bases")
		{
			knowledge.GET("", handlers.ListKnowledgeBases())
			knowledge.POST("", handlers.CreateKnowledgeBase())
			knowledge.GET("/:id", handlers.GetKnowledgeBase())
			knowledge.PUT("/:id", handlers.UpdateKnowledgeBase())
			knowledge.DELETE("/:id", handlers.DeleteKnowledgeBase())
			knowledge.POST("/:id/files", handlers.UploadKnowledgeFile())
			knowledge.PUT("/:id/files/:fileId", handlers.UpdateKnowledgeFile())
			knowledge.DELETE("/:id/files/:fileId", handlers.DeleteKnowledgeFile())
			knowledge.PUT("/:id/files/reorder", handlers.ReorderKnowledgeFiles())
			knowledge.GET("/:id/files/:fileId/content", handlers.GetKnowledgeFileContent())
		}

		admin := api.Group("/admin")
		{
			admin.GET("/subjects", handlers.AdminListSubjects())
			admin.DELETE("/subjects/:id", handlers.AdminDeleteSubject())
			admin.PUT("/users/:id/role", handlers.AdminUpdateUserRole())
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
