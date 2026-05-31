package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
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
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, _ := latestUserID(c, db)
		if userID == "" {
			userID = "0"
		}
		subjectName := "未知学科"
		_ = db.QueryRowContext(c, `SELECT name FROM subjects WHERE subject_id = ?`, subjectID).Scan(&subjectName)
		data := webAnalytics{
			UserID:      userID,
			SubjectID:   subjectID,
			SubjectName: subjectName,
			WeakPoints:  []map[string]any{},
			WordCloud:   []map[string]any{},
			UpdatedAt:   time.Now().UTC().Format(time.RFC3339),
		}
		err = db.QueryRowContext(
			c,
			`SELECT summary, summary_generated_at, updated_at FROM analytics_summaries WHERE user_id = ? AND subject_id = ?`,
			userID,
			subjectID,
		).Scan(&data.Summary, &data.SummaryGeneratedAt, &data.UpdatedAt)
		if err != nil && err != sql.ErrNoRows {
			response.Error(c, http.StatusInternalServerError, "ANALYTICS_QUERY_FAILED", "failed to query analytics")
			return
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
		summary := "根据最近学习表现，建议优先复习高频错题知识点并强化专项训练。"
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, _ := latestUserID(c, db)
		if userID == "" {
			response.Error(c, http.StatusBadRequest, "USER_NOT_FOUND", "no user available")
			return
		}
		_, err = db.ExecContext(
			c,
			`INSERT INTO analytics_summaries (user_id, subject_id, summary, summary_generated_at, updated_at)
			 VALUES (?, ?, ?, NOW(), NOW())
			 ON DUPLICATE KEY UPDATE summary = VALUES(summary), summary_generated_at = NOW(), updated_at = NOW()`,
			userID,
			subjectID,
			summary,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ANALYTICS_UPDATE_FAILED", "failed to update analytics summary")
			return
		}
		response.OK(c, gin.H{"summary": summary})
	}
}

func AdminUpdateUserRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			UserID string `json:"userId"`
			Role   string `json:"role"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid role body")
			return
		}
		if strings.TrimSpace(req.UserID) == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_USER_ID", "userId is required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		result, err := db.ExecContext(c, `UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?`, req.Role, req.UserID)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "USER_ROLE_UPDATE_FAILED", "failed to update user role")
			return
		}
		if affected, _ := result.RowsAffected(); affected == 0 {
			response.Error(c, http.StatusNotFound, "USER_NOT_FOUND", "user not found")
			return
		}
		response.OK(c, gin.H{"updated": true})
	}
}

func AdminListUsers() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Search string `json:"search"`
		}
		_ = c.ShouldBindJSON(&req)
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		query := `SELECT id, username, phone, role, created_at, updated_at FROM users`
		args := []any{}
		if strings.TrimSpace(req.Search) != "" {
			query += ` WHERE username LIKE ? OR phone LIKE ? OR CAST(id AS CHAR) LIKE ?`
			like := "%" + req.Search + "%"
			args = append(args, like, like, like)
		}
		query += ` ORDER BY id DESC LIMIT 200`
		rows, err := db.QueryContext(c, query, args...)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "USERS_LIST_FAILED", "failed to list users")
			return
		}
		defer rows.Close()
		list := make([]webUser, 0, 64)
		for rows.Next() {
			var item webUser
			if err := rows.Scan(&item.ID, &item.Username, &item.Phone, &item.Role, &item.CreatedAt, &item.UpdatedAt); err != nil {
				response.Error(c, http.StatusInternalServerError, "USERS_LIST_FAILED", "failed to list users")
				return
			}
			list = append(list, item)
		}
		response.OK(c, gin.H{"list": list, "total": len(list)})
	}
}
