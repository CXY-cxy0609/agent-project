package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

func GetAnalytics() gin.HandlerFunc {
	return func(c *gin.Context) {
		subjectID, err := strconv.Atoi(c.Param("subjectId"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		state.mu.RLock()
		data, ok := state.analytics[subjectID]
		state.mu.RUnlock()
		if !ok {
			data = webAnalytics{
				UserID:      "mock-user-001",
				SubjectID:   subjectID,
				SubjectName: "未知学科",
				WeakPoints:  []map[string]any{},
				WordCloud:   []map[string]any{},
				UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
			}
		}
		response.OK(c, gin.H{
			"userId":             data.UserID,
			"subjectId":          data.SubjectID,
			"subjectName":        data.SubjectName,
			"weakPoints":         data.WeakPoints,
			"wordCloud":          data.WordCloud,
			"summary":            data.Summary,
			"summaryGeneratedAt": data.SummaryGeneratedAt,
			"updatedAt":          data.UpdatedAt,
		})
	}
}

func GenerateAnalyticsSummary() gin.HandlerFunc {
	return func(c *gin.Context) {
		subjectID, err := strconv.Atoi(c.Param("subjectId"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		summary := "根据最近学习表现，建议优先复习高频错题知识点并强化专项训练。"
		state.mu.Lock()
		item := state.analytics[subjectID]
		if item.SubjectID == 0 {
			item = webAnalytics{
				UserID:      "mock-user-001",
				SubjectID:   subjectID,
				SubjectName: subjectNameByID(state.subjects, subjectID),
				WeakPoints:  []map[string]any{},
				WordCloud:   []map[string]any{},
			}
		}
		item.Summary = summary
		item.SummaryGeneratedAt = now
		item.UpdatedAt = now
		state.analytics[subjectID] = item
		state.mu.Unlock()
		response.OK(c, gin.H{"summary": summary})
	}
}

func AdminUpdateUserRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		var req struct {
			Role string `json:"role"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid role body")
			return
		}
		state.mu.Lock()
		user := state.users[userID]
		if user.ID == "" {
			user = webUser{
				ID:        userID,
				Username:  "新用户",
				Phone:     "13800000000",
				Role:      "student",
				CreatedAt: time.Now().UTC().Format(time.RFC3339),
				UpdatedAt: time.Now().UTC().Format(time.RFC3339),
			}
		}
		user.Role = req.Role
		user.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state.users[user.ID] = user
		state.mu.Unlock()
		response.OK(c, gin.H{"updated": true})
	}
}
