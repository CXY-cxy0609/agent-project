package handlers

import (
	"database/sql"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

type createConversationWebReq struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	SubjectID int    `json:"subjectId"`
	UserID    string `json:"userId"`
}

type listConversationReq struct {
	SubjectID int    `json:"subjectId"`
	Title     string `json:"title"`
	Page      int    `json:"page"`
	PageSize  int    `json:"pageSize"`
}

type identifyConversationReq struct {
	ID string `json:"id"`
}

type createMessageReq struct {
	ConversationID string `json:"conversationId"`
	ID             string `json:"id"`
	Role           string `json:"role"`
	Content        string `json:"content"`
	Status         string `json:"status"`
}

func ListConversationsWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req listConversationReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid conversation list body")
			return
		}
		subjectID := req.SubjectID
		titleKeyword := req.Title
		page := req.Page
		pageSize := req.PageSize
		if page <= 0 {
			page = 1
		}
		if pageSize <= 0 {
			pageSize = 20
		}

		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		list, err := queryWebConversations(c, db, subjectID, titleKeyword)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "CONVERSATIONS_LIST_FAILED", "failed to list conversations")
			return
		}

		sort.Slice(list, func(i, j int) bool {
			return list[i].UpdatedAt > list[j].UpdatedAt
		})
		total := len(list)
		start := (page - 1) * pageSize
		if start > total {
			start = total
		}
		end := start + pageSize
		if end > total {
			end = total
		}
		response.OK(c, gin.H{
			"list":     list[start:end],
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		})
	}
}

func GetConversationWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifyConversationReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid conversation detail body")
			return
		}
		id := req.ID
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		conversation, err := getWebConversationByID(c, db, id)
		if err != nil {
			if err == sql.ErrNoRows {
				response.Error(c, http.StatusNotFound, "CONVERSATION_NOT_FOUND", "conversation not found")
				return
			}
			response.Error(c, http.StatusInternalServerError, "CONVERSATION_QUERY_FAILED", "failed to query conversation")
			return
		}
		if conversation.ID == "" {
			response.Error(c, http.StatusNotFound, "CONVERSATION_NOT_FOUND", "conversation not found")
			return
		}
		response.OK(c, gin.H{
			"id":           conversation.ID,
			"title":        conversation.Title,
			"subjectId":    conversation.SubjectID,
			"subjectName":  conversation.SubjectName,
			"userId":       conversation.UserID,
			"createdAt":    conversation.CreatedAt,
			"updatedAt":    conversation.UpdatedAt,
			"messageCount": conversation.MessageCount,
		})
	}
}

func CreateConversationWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createConversationWebReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid conversation body")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		// 会话 ID 始终由服务端生成，前端传入值仅作为兼容字段忽略。
		req.ID = "conv-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		if strings.TrimSpace(req.UserID) == "" {
			userID, _ := latestUserID(c, db)
			req.UserID = userID
		}
		if strings.TrimSpace(req.UserID) == "" {
			req.UserID = "0"
		}
		conversation := webConversation{
			ID:           req.ID,
			Title:        req.Title,
			SubjectID:    req.SubjectID,
			SubjectName:  "未分配学科",
			UserID:       req.UserID,
			CreatedAt:    now,
			UpdatedAt:    now,
			MessageCount: 0,
		}
		subjectName, _ := querySubjectName(c, db, conversation.SubjectID)
		if subjectName != "" {
			conversation.SubjectName = subjectName
		}
		if err := insertWebConversation(c, db, conversation); err != nil {
			response.Error(c, http.StatusInternalServerError, "CONVERSATION_CREATE_FAILED", "failed to create conversation")
			return
		}
		response.Created(c, gin.H{"conversation": conversation})
	}
}

func DeleteConversationWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifyConversationReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid conversation delete body")
			return
		}
		id := req.ID
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		_, _ = db.ExecContext(c, `DELETE FROM conversation_messages WHERE conversation_id = ?`, id)
		_, _ = db.ExecContext(c, `DELETE FROM conversations WHERE conversation_id = ?`, id)
		response.OK(c, gin.H{"deleted": true})
	}
}

func ListConversationMessages() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifyConversationReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid message list body")
			return
		}
		id := req.ID
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		items, err := queryWebMessages(c, db, id)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "MESSAGES_LIST_FAILED", "failed to list messages")
			return
		}
		response.OK(c, gin.H{"list": items})
	}
}

func CreateConversationMessage() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createMessageReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid message body")
			return
		}
		conversationID := req.ConversationID
		if strings.TrimSpace(conversationID) == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_CONVERSATION_ID", "conversationId is required")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if req.ID == "" {
			req.ID = "msg-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		}
		if req.Status == "" {
			req.Status = "done"
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		conversation, err := getWebConversationByID(c, db, conversationID)
		if err != nil && err != sql.ErrNoRows {
			response.Error(c, http.StatusInternalServerError, "CONVERSATION_QUERY_FAILED", "failed to query conversation")
			return
		}
		if conversation.ID == "" {
			userID, _ := latestUserID(c, db)
			if userID == "" {
				userID = "0"
			}
			conversation = webConversation{
				ID:           conversationID,
				Title:        "新对话",
				SubjectID:    0,
				SubjectName:  "未分配学科",
				UserID:       userID,
				CreatedAt:    now,
				UpdatedAt:    now,
				MessageCount: 0,
			}
			if err := insertWebConversation(c, db, conversation); err != nil {
				response.Error(c, http.StatusInternalServerError, "CONVERSATION_CREATE_FAILED", "failed to create conversation")
				return
			}
		}
		msg := webMessage{
			ID:             req.ID,
			ConversationID: conversationID,
			Role:           req.Role,
			Content:        req.Content,
			Status:         req.Status,
			CreatedAt:      now,
		}
		if err := insertWebMessage(c, db, msg); err != nil {
			response.Error(c, http.StatusInternalServerError, "MESSAGE_CREATE_FAILED", "failed to create message")
			return
		}
		conversation.MessageCount = countWebMessages(c, db, conversationID)
		conversation.UpdatedAt = now
		if req.Role == "user" && conversation.Title == "新对话" && strings.TrimSpace(req.Content) != "" {
			runes := []rune(strings.TrimSpace(req.Content))
			if len(runes) > 24 {
				conversation.Title = string(runes[:24])
			} else {
				conversation.Title = string(runes)
			}
		}
		if err := updateWebConversation(c, db, conversation); err != nil {
			response.Error(c, http.StatusInternalServerError, "CONVERSATION_UPDATE_FAILED", "failed to update conversation")
			return
		}

		response.Created(c, gin.H{"message": msg})
	}
}

func queryWebConversations(c *gin.Context, db *sql.DB, subjectID int, title string) ([]webConversation, error) {
	query := `SELECT c.conversation_id, c.title, c.subject_id, c.user_id, c.created_at, c.updated_at,
		COALESCE(s.name, '未分配学科') AS subject_name,
		(SELECT COUNT(1) FROM conversation_messages m WHERE m.conversation_id = c.conversation_id) AS message_count
		FROM conversations c
		LEFT JOIN subjects s ON s.subject_id = c.subject_id
		WHERE 1=1`
	args := []any{}
	if subjectID > 0 {
		query += ` AND c.subject_id = ?`
		args = append(args, subjectID)
	}
	if strings.TrimSpace(title) != "" {
		query += ` AND c.title LIKE ?`
		args = append(args, "%"+title+"%")
	}
	query += ` ORDER BY c.updated_at DESC, c.id DESC`
	rows, err := db.QueryContext(c, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]webConversation, 0, 32)
	for rows.Next() {
		var item webConversation
		if err := rows.Scan(&item.ID, &item.Title, &item.SubjectID, &item.UserID, &item.CreatedAt, &item.UpdatedAt, &item.SubjectName, &item.MessageCount); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func getWebConversationByID(c *gin.Context, db *sql.DB, id string) (webConversation, error) {
	var item webConversation
	err := db.QueryRowContext(
		c,
		`SELECT c.conversation_id, c.title, c.subject_id, c.user_id, c.created_at, c.updated_at,
		COALESCE(s.name, '未分配学科') AS subject_name,
		(SELECT COUNT(1) FROM conversation_messages m WHERE m.conversation_id = c.conversation_id) AS message_count
		FROM conversations c
		LEFT JOIN subjects s ON s.subject_id = c.subject_id
		WHERE c.conversation_id = ?`,
		id,
	).Scan(&item.ID, &item.Title, &item.SubjectID, &item.UserID, &item.CreatedAt, &item.UpdatedAt, &item.SubjectName, &item.MessageCount)
	if err != nil {
		return webConversation{}, err
	}
	return item, nil
}

func insertWebConversation(c *gin.Context, db *sql.DB, item webConversation) error {
	_, err := db.ExecContext(
		c,
		`INSERT INTO conversations (conversation_id, title, subject_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
		item.ID,
		item.Title,
		item.SubjectID,
		item.UserID,
	)
	return err
}

func updateWebConversation(c *gin.Context, db *sql.DB, item webConversation) error {
	_, err := db.ExecContext(
		c,
		`UPDATE conversations SET title = ?, subject_id = ?, updated_at = NOW() WHERE conversation_id = ?`,
		item.Title,
		item.SubjectID,
		item.ID,
	)
	return err
}

func queryWebMessages(c *gin.Context, db *sql.DB, conversationID string) ([]webMessage, error) {
	rows, err := db.QueryContext(
		c,
		`SELECT message_id, conversation_id, role, content, created_at
		FROM conversation_messages
		WHERE conversation_id = ?
		ORDER BY created_at ASC, id ASC`,
		conversationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]webMessage, 0, 64)
	for rows.Next() {
		var item webMessage
		if err := rows.Scan(&item.ID, &item.ConversationID, &item.Role, &item.Content, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.Status = "done"
		list = append(list, item)
	}
	return list, rows.Err()
}

func insertWebMessage(c *gin.Context, db *sql.DB, item webMessage) error {
	_, err := db.ExecContext(
		c,
		`INSERT INTO conversation_messages (message_id, conversation_id, role, content, token_usage, created_at) VALUES (?, ?, ?, ?, 0, NOW())`,
		item.ID,
		item.ConversationID,
		item.Role,
		item.Content,
	)
	return err
}

func countWebMessages(c *gin.Context, db *sql.DB, conversationID string) int {
	var cnt int
	_ = db.QueryRowContext(c, `SELECT COUNT(1) FROM conversation_messages WHERE conversation_id = ?`, conversationID).Scan(&cnt)
	return cnt
}

func querySubjectName(c *gin.Context, db *sql.DB, subjectID int) (string, error) {
	if subjectID <= 0 {
		return "", nil
	}
	var name string
	err := db.QueryRowContext(c, `SELECT name FROM subjects WHERE subject_id = ?`, subjectID).Scan(&name)
	if err != nil {
		return "", err
	}
	return name, nil
}
