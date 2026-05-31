package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/domain"
	"tutor-server/internal/http/response"
	"tutor-server/internal/repository"
	"tutor-server/internal/service"
)

type createLearningRecordReq struct {
	UserID         string `json:"userId"`
	SessionID      string `json:"sessionId"`
	Subject        string `json:"subject"`
	Chapter        string `json:"chapter"`
	KnowledgePoint string `json:"knowledgePoint"`
	Difficulty     string `json:"difficulty"`
	AskedAt        string `json:"askedAt"`
}

func CreateLearningRecord(recordService *service.LearningRecordService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createLearningRecordReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid learning record body")
			return
		}
		if req.UserID == "" || req.SessionID == "" || req.Subject == "" || req.KnowledgePoint == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_LEARNING_RECORD_FIELDS", "userId, sessionId, subject, knowledgePoint are required")
			return
		}

		err := recordService.Write(c.Request.Context(), domain.LearningRecord{
			UserID:         req.UserID,
			SessionID:      req.SessionID,
			Subject:        req.Subject,
			Chapter:        req.Chapter,
			KnowledgePoint: req.KnowledgePoint,
			Difficulty:     req.Difficulty,
			AskedAt:        req.AskedAt,
		})
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "LEARNING_RECORD_CREATE_FAILED", "failed to create learning record")
			return
		}

		response.Created(c, gin.H{"status": "stored"})
	}
}

func QueryLearningRecords(recordService *service.LearningRecordService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Query("user_id")
		if userID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_USER_ID", "user_id is required")
			return
		}
		limit := 30
		if q := c.Query("limit"); q != "" {
			if parsed, err := strconv.Atoi(q); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		list, err := recordService.Query(c.Request.Context(), userID, repository.LearningRecordFilter{
			Subject: c.Query("subject"),
			Chapter: c.Query("chapter"),
			Limit:   limit,
		})
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "LEARNING_RECORD_QUERY_FAILED", "failed to query learning records")
			return
		}

		// Keep backward compatibility for current agent side query implementation.
		c.JSON(http.StatusOK, list)
	}
}
