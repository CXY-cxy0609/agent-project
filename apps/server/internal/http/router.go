package http

import (
	"net/http"
	"net/url"
	"strings"
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
	handlers.UseDBStore(container.DBStore())
	handlers.UseObjectStorage(cfg.ObjectStorage)
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	_ = r.SetTrustedProxies(nil)
	r.Use(middleware.RequestID())
	r.Use(middleware.AccessLog())
	r.Use(middleware.NewIdempotencyStore(5 * time.Minute).Middleware())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     parseAllowedOrigins(cfg.FrontendURL),
		AllowOriginFunc:  buildAllowOriginFunc(cfg.NodeEnv),
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
			auth.POST("/register", handlers.Register(container.AuthService))
			auth.PUT("/password", handlers.UpdatePassword())
			auth.GET("/profile", handlers.GetProfile())
			auth.PUT("/profile", handlers.UpdateProfile())
		}

		subjects := api.Group("/subjects")
		{
			subjects.POST("/list", handlers.ListMySubjects())
			subjects.POST("/search", handlers.SearchSubjects())
			subjects.POST("", handlers.CreateSubject())
			subjects.POST("/update", handlers.UpdateSubject())
			subjects.POST("/delete", handlers.DeleteSubject())
			subjects.POST("/my/list", handlers.ListMySubjects())
			subjects.POST("/my", handlers.AddMySubject())
			subjects.POST("/my/remove", handlers.RemoveMySubject())
			subjects.POST("/outline/get", handlers.GetSubjectOutline())
			subjects.POST("/outline/update", handlers.UpdateSubjectOutline())
		}

		conversations := api.Group("/conversations")
		{
			conversations.POST("/list", handlers.ListConversationsWeb())
			conversations.POST("", handlers.CreateConversationWeb())
			conversations.POST("/detail", handlers.GetConversationWeb())
			conversations.POST("/delete", handlers.DeleteConversationWeb())
			conversations.POST("/messages/list", handlers.ListConversationMessages())
			conversations.POST("/messages/create", handlers.CreateConversationMessage())
		}

		analytics := api.Group("/analytics")
		{
			analytics.GET("/:subjectId", handlers.GetAnalytics())
			analytics.POST("/:subjectId/summary", handlers.GenerateAnalyticsSummary())
		}

		knowledge := api.Group("/knowledge-bases")
		{
			knowledge.POST("/list", handlers.ListKnowledgeBases())
			knowledge.POST("", handlers.CreateKnowledgeBase())
			knowledge.POST("/detail", handlers.GetKnowledgeBase())
			knowledge.POST("/update", handlers.UpdateKnowledgeBase())
			knowledge.POST("/delete", handlers.DeleteKnowledgeBase())
			knowledge.POST("/files/upload", handlers.UploadKnowledgeFile())
			knowledge.POST("/files/update", handlers.UpdateKnowledgeFile())
			knowledge.POST("/files/delete", handlers.DeleteKnowledgeFile())
			knowledge.POST("/files/reorder", handlers.ReorderKnowledgeFiles())
			knowledge.POST("/files/content", handlers.GetKnowledgeFileContent())
		}

		admin := api.Group("/admin")
		{
			admin.POST("/subjects/list", handlers.AdminListSubjects())
			admin.POST("/subjects/delete", handlers.AdminDeleteSubject())
			admin.POST("/users/list", handlers.AdminListUsers())
			admin.POST("/users/role/update", handlers.AdminUpdateUserRole())
		}

		chat := api.Group("/chat")
		{
			chat.POST("/stream", handlers.ChatStream(cfg.AI.AgentServiceURL))
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

func parseAllowedOrigins(frontendURL string) []string {
	parts := strings.Split(frontendURL, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		return []string{"http://localhost:5173"}
	}
	return origins
}

func buildAllowOriginFunc(nodeEnv string) func(string) bool {
	if nodeEnv == "production" {
		return nil
	}
	return func(origin string) bool {
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		host := strings.ToLower(u.Hostname())
		return host == "localhost" || host == "127.0.0.1" || host == "::1"
	}
}
