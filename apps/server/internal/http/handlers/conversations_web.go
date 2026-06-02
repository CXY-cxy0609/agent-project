package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
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
	ConversationID string                 `json:"conversationId"`
	ID             string                 `json:"id"`
	Role           string                 `json:"role"`
	Content        string                 `json:"content"`
	ContentInline  string                 `json:"contentInline"`
	ContentRef     string                 `json:"contentRef"`
	ContentHash    string                 `json:"contentHash"`
	ContentSize    int64                  `json:"contentSize"`
	TurnID         string                 `json:"turnId"`
	ReplyToID      string                 `json:"replyToMessageId"`
	TokenUsage     int                    `json:"tokenUsage"`
	Status         string                 `json:"status"`
	Metadata       any                    `json:"metadata"`
	Attachments    []webMessageAttachment `json:"attachments"`
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
		_, _ = db.ExecContext(c, `DELETE FROM conversation_message_attachments WHERE conversation_id = ?`, id)
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
			log.Printf("queryWebMessages failed conversation_id=%s err=%v", id, err)
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
			ContentInline:  resolveContentInline(req.ContentInline, req.Content),
			ContentRef:     strings.TrimSpace(req.ContentRef),
			ContentHash:    strings.TrimSpace(req.ContentHash),
			ContentSize:    resolveContentSize(req.ContentSize, req.ContentInline, req.Content),
			TurnID:         strings.TrimSpace(req.TurnID),
			ReplyToID:      strings.TrimSpace(req.ReplyToID),
			TokenUsage:     req.TokenUsage,
			Status:         req.Status,
			CreatedAt:      now,
			Metadata:       req.Metadata,
			Attachments:    normalizeMessageAttachments(req.Attachments),
		}
		if (msg.Role == "user" || msg.Role == "assistant") &&
			strings.TrimSpace(msg.ContentInline) == "" &&
			strings.TrimSpace(msg.ContentRef) == "" &&
			len(msg.Attachments) == 0 {
			response.Error(c, http.StatusBadRequest, "INVALID_MESSAGE_CONTENT", "message content is required")
			return
		}
		if msg.TurnID == "" && msg.Role == "user" {
			msg.TurnID = "turn-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		}
		if err := enrichMessageStorage(c, db, &msg); err != nil {
			log.Printf(
				"enrichMessageStorage failed conversation_id=%s message_id=%s role=%s err=%v",
				conversationID,
				msg.ID,
				msg.Role,
				err,
			)
			response.Error(c, http.StatusInternalServerError, "MESSAGE_EXTERNALIZE_FAILED", "failed to persist externalized content")
			return
		}
		if err := insertWebMessage(c, db, msg); err != nil {
			log.Printf(
				"insertWebMessage failed conversation_id=%s message_id=%s role=%s err=%v",
				conversationID,
				msg.ID,
				msg.Role,
				err,
			)
			response.Error(c, http.StatusInternalServerError, "MESSAGE_CREATE_FAILED", "failed to create message")
			return
		}
		if len(msg.Attachments) > 0 {
			if err := insertWebMessageAttachments(c, db, msg.ID, conversationID, msg.Attachments); err != nil {
				log.Printf("insertWebMessageAttachments failed conversation_id=%s message_id=%s err=%v", conversationID, msg.ID, err)
				response.Error(c, http.StatusInternalServerError, "MESSAGE_ATTACHMENTS_CREATE_FAILED", "failed to create message attachments")
				return
			}
		}
		conversation.MessageCount = countWebMessages(c, db, conversationID)
		conversation.UpdatedAt = now
		titleSource := strings.TrimSpace(resolveContentInline(req.ContentInline, req.Content))
		if req.Role == "user" && conversation.Title == "新对话" && titleSource != "" {
			runes := []rune(titleSource)
			if len(runes) > 24 {
				conversation.Title = string(runes[:24])
			} else {
				conversation.Title = string(runes)
			}
		}
		if err := updateWebConversation(c, db, conversation); err != nil {
			log.Printf("updateWebConversation failed conversation_id=%s err=%v", conversationID, err)
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
		`SELECT message_id, conversation_id, role, content_inline, content_ref, content_hash, content_size,
		turn_id, reply_to_message_id, token_usage, metadata_json, status, created_at
		FROM conversation_messages
		WHERE conversation_id = ?
		ORDER BY seq ASC, id ASC`,
		conversationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]webMessage, 0, 64)
	for rows.Next() {
		var item webMessage
		var contentInline sql.NullString
		var contentRef sql.NullString
		var contentHash sql.NullString
		var turnID sql.NullString
		var replyToID sql.NullString
		var status sql.NullString
		var metadataRaw sql.NullString
		if err := rows.Scan(
			&item.ID,
			&item.ConversationID,
			&item.Role,
			&contentInline,
			&contentRef,
			&contentHash,
			&item.ContentSize,
			&turnID,
			&replyToID,
			&item.TokenUsage,
			&metadataRaw,
			&status,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}
		if contentInline.Valid {
			item.ContentInline = contentInline.String
		}
		if contentRef.Valid {
			item.ContentRef = contentRef.String
		}
		if contentHash.Valid {
			item.ContentHash = contentHash.String
		}
		if turnID.Valid {
			item.TurnID = turnID.String
		}
		if replyToID.Valid {
			item.ReplyToID = replyToID.String
		}
		if status.Valid {
			item.Status = status.String
		}
		if metadataRaw.Valid && strings.TrimSpace(metadataRaw.String) != "" {
			var decoded map[string]any
			if err := json.Unmarshal([]byte(metadataRaw.String), &decoded); err == nil {
				item.Metadata = decoded
			}
		}
		item.Content = resolveWebMessageContent(item)
		if strings.TrimSpace(item.Status) == "" {
			item.Status = "done"
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := attachWebMessageAttachments(c, db, conversationID, list); err != nil {
		return nil, err
	}
	return list, nil
}

func insertWebMessage(c *gin.Context, db *sql.DB, item webMessage) error {
	seq, err := nextConversationMessageSeq(c, db, item.ConversationID)
	if err != nil {
		return err
	}
	metadataJSON := sql.NullString{}
	if item.Metadata != nil {
		raw, err := json.Marshal(item.Metadata)
		if err != nil {
			return err
		}
		metadataJSON = sql.NullString{String: string(raw), Valid: true}
	}
	_, err = db.ExecContext(
		c,
		`INSERT INTO conversation_messages
		(message_id, conversation_id, seq, turn_id, reply_to_message_id, role, status, content_inline, content_ref, content_hash, content_size, token_usage, metadata_json, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
		item.ID,
		item.ConversationID,
		seq,
		item.TurnID,
		item.ReplyToID,
		item.Role,
		item.Status,
		item.ContentInline,
		item.ContentRef,
		item.ContentHash,
		item.ContentSize,
		item.TokenUsage,
		metadataJSON,
	)
	return err
}

func insertWebMessageAttachments(c *gin.Context, db *sql.DB, messageID string, conversationID string, attachments []webMessageAttachment) error {
	for _, attachment := range normalizeMessageAttachments(attachments) {
		if attachment.ID == "" {
			attachment.ID = "att-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		}
		if attachment.Status == "" {
			attachment.Status = "done"
		}
		_, err := db.ExecContext(
			c,
			`INSERT INTO conversation_message_attachments
			(attachment_id, message_id, conversation_id, name, mime_type, type, size, url, object_key, thumbnail_url, hash, status, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
			attachment.ID,
			messageID,
			conversationID,
			attachment.Name,
			attachment.MimeType,
			attachment.Type,
			attachment.Size,
			attachment.URL,
			attachment.StorageKey,
			attachment.ThumbnailURL,
			attachment.Hash,
			attachment.Status,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func attachWebMessageAttachments(c *gin.Context, db *sql.DB, conversationID string, messages []webMessage) error {
	if len(messages) == 0 {
		return nil
	}
	rows, err := db.QueryContext(
		c,
		`SELECT attachment_id, message_id, name, mime_type, type, size, url, object_key, thumbnail_url, hash, status
		FROM conversation_message_attachments
		WHERE conversation_id = ?
		ORDER BY id ASC`,
		conversationID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	byMessageID := make(map[string][]webMessageAttachment, len(messages))
	for rows.Next() {
		var messageID string
		var attachment webMessageAttachment
		var mimeType sql.NullString
		var objectKey sql.NullString
		var thumbnailURL sql.NullString
		var hash sql.NullString
		var status sql.NullString
		if err := rows.Scan(
			&attachment.ID,
			&messageID,
			&attachment.Name,
			&mimeType,
			&attachment.Type,
			&attachment.Size,
			&attachment.URL,
			&objectKey,
			&thumbnailURL,
			&hash,
			&status,
		); err != nil {
			return err
		}
		if mimeType.Valid {
			attachment.MimeType = mimeType.String
		}
		if objectKey.Valid {
			attachment.StorageKey = objectKey.String
		}
		if thumbnailURL.Valid {
			attachment.ThumbnailURL = thumbnailURL.String
		}
		if hash.Valid {
			attachment.Hash = hash.String
		}
		if status.Valid {
			attachment.Status = status.String
		}
		byMessageID[messageID] = append(byMessageID[messageID], attachment)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i := range messages {
		messages[i].Attachments = byMessageID[messages[i].ID]
	}
	return nil
}

func normalizeMessageAttachments(attachments []webMessageAttachment) []webMessageAttachment {
	if len(attachments) == 0 {
		return nil
	}
	capacityLen := len(attachments)
	if capacityLen > maxChatAttachmentCount {
		capacityLen = maxChatAttachmentCount
	}
	normalized := make([]webMessageAttachment, 0, capacityLen)
	for _, attachment := range attachments {
		if len(normalized) >= maxChatAttachmentCount {
			break
		}
		attachment.ID = strings.TrimSpace(attachment.ID)
		attachment.Name = strings.TrimSpace(attachment.Name)
		attachment.URL = strings.TrimSpace(attachment.URL)
		attachment.Type = strings.TrimSpace(attachment.Type)
		attachment.MimeType = strings.TrimSpace(attachment.MimeType)
		attachment.StorageKey = strings.TrimSpace(attachment.StorageKey)
		attachment.ThumbnailURL = strings.TrimSpace(attachment.ThumbnailURL)
		attachment.Hash = strings.TrimSpace(attachment.Hash)
		attachment.Status = strings.TrimSpace(attachment.Status)
		if attachment.Name == "" || attachment.URL == "" || attachment.Type == "" || attachment.Size <= 0 {
			continue
		}
		normalized = append(normalized, attachment)
	}
	return normalized
}

func nextConversationMessageSeq(c *gin.Context, db *sql.DB, conversationID string) (int64, error) {
	var seq int64
	err := db.QueryRowContext(
		c,
		`SELECT COALESCE(MAX(seq), 0) + 1 FROM conversation_messages WHERE conversation_id = ?`,
		conversationID,
	).Scan(&seq)
	if err != nil {
		return 0, err
	}
	return seq, nil
}

func resolveContentInline(contentInline string, content string) string {
	if strings.TrimSpace(contentInline) != "" {
		return contentInline
	}
	return content
}

func resolveContentSize(contentSize int64, contentInline string, content string) int64 {
	if contentSize > 0 {
		return contentSize
	}
	merged := resolveContentInline(contentInline, content)
	return int64(len([]byte(merged)))
}

func resolveWebMessageContent(item webMessage) string {
	inline := strings.TrimSpace(item.ContentInline)
	if inline != "" {
		return item.ContentInline
	}
	if strings.TrimSpace(item.ContentRef) != "" {
		return "[内容已外置存储，待回源加载]"
	}
	return ""
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
