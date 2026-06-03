package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type chatStreamReq struct {
	ConversationID string                 `json:"conversationId"`
	SubjectID      int                    `json:"subjectId"`
	Content        string                 `json:"content"`
	UserID         string                 `json:"userId"`
	TurnID         string                 `json:"turnId"`
	UserMessageID  string                 `json:"userMessageId"`
	AssistantMsgID string                 `json:"assistantMessageId"`
	MessageCount   int                    `json:"messageCount"`
	Attachments    []webMessageAttachment `json:"attachments"`
}

type conversationTurn struct {
	Conversation   webConversation
	UserMessage    webMessage
	AssistantMsg   webMessage
	WasFirstTurn   bool
	UserContent    string
	SubjectID      int
	UserID         string
	ConversationID string
}

func beginConversationTurn(c *gin.Context, db *sql.DB, req chatStreamReq) (conversationTurn, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	conversationID := strings.TrimSpace(req.ConversationID)
	if conversationID == "" {
		conversationID = "conv-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	turnID := strings.TrimSpace(req.TurnID)
	if turnID == "" {
		turnID = "turn-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	userMessageID := strings.TrimSpace(req.UserMessageID)
	if userMessageID == "" {
		userMessageID = "msg-" + strconv.FormatInt(time.Now().UnixNano(), 10) + "-u"
	}
	assistantMessageID := strings.TrimSpace(req.AssistantMsgID)
	if assistantMessageID == "" {
		assistantMessageID = "msg-" + strconv.FormatInt(time.Now().UnixNano(), 10) + "-a"
	}

	userID := strings.TrimSpace(req.UserID)
	if userID == "" || userID == "anonymous" {
		latest, _ := latestUserID(c, db)
		userID = latest
	}
	if userID == "" {
		userID = "0"
	}
	subjectID, err := resolveConversationSubjectID(c, db, req.SubjectID, userID)
	if err != nil {
		return conversationTurn{}, err
	}

	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		return conversationTurn{}, err
	}
	defer rollbackQuietly(tx)

	conversation, existed, err := lockOrCreateConversation(c, tx, conversationID, subjectID, userID, now)
	if err != nil {
		return conversationTurn{}, err
	}
	subjectID = conversation.SubjectID
	existingCount, err := countWebMessagesTx(c, tx, conversationID)
	if err != nil {
		return conversationTurn{}, err
	}
	firstSeq := existingCount + 1
	userMsg := webMessage{
		ID:             userMessageID,
		ConversationID: conversationID,
		Seq:            firstSeq,
		Role:           "user",
		Status:         "done",
		ContentInline:  req.Content,
		TurnID:         turnID,
		CreatedAt:      now,
		Attachments:    normalizeMessageAttachments(req.Attachments),
	}
	if err := prepareMessageStorage(&userMsg); err != nil {
		return conversationTurn{}, err
	}
	assistantMsg := webMessage{
		ID:             assistantMessageID,
		ConversationID: conversationID,
		Seq:            firstSeq + 1,
		Role:           "assistant",
		Status:         "streaming",
		ContentInline:  "",
		TurnID:         turnID,
		ReplyToID:      userMessageID,
		CreatedAt:      now,
	}
	if err := insertWebMessageTx(c, tx, userMsg); err != nil {
		return conversationTurn{}, err
	}
	if len(userMsg.Attachments) > 0 {
		if err := insertWebMessageAttachmentsTx(c, tx, userMsg.ID, conversationID, userMsg.Attachments); err != nil {
			return conversationTurn{}, err
		}
	}
	if err := insertWebMessageTx(c, tx, assistantMsg); err != nil {
		return conversationTurn{}, err
	}
	conversation.MessageCount = int(existingCount + 2)
	conversation.UpdatedAt = now
	if err := updateWebConversationTx(c, tx, conversation); err != nil {
		return conversationTurn{}, err
	}
	if err := tx.Commit(); err != nil {
		return conversationTurn{}, err
	}
	if subjectName, _ := querySubjectName(c, db, conversation.SubjectID); subjectName != "" {
		conversation.SubjectName = subjectName
	}

	_ = existed
	return conversationTurn{
		Conversation:   conversation,
		UserMessage:    userMsg,
		AssistantMsg:   assistantMsg,
		WasFirstTurn:   existingCount == 0,
		UserContent:    req.Content,
		SubjectID:      subjectID,
		UserID:         userID,
		ConversationID: conversationID,
	}, nil
}

func finalizeConversationTurn(c *gin.Context, db *sql.DB, turn conversationTurn, assistantContent string, metadata map[string]any, title string) (conversationTurn, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		return turn, err
	}
	defer rollbackQuietly(tx)

	conversation, err := lockConversation(c, tx, turn.ConversationID)
	if err != nil {
		return turn, err
	}
	assistantMsg := turn.AssistantMsg
	assistantMsg.ContentInline = assistantContent
	assistantMsg.Status = "done"
	assistantMsg.Metadata = metadata
	if err := prepareMessageStorage(&assistantMsg); err != nil {
		return turn, err
	}
	if err := updateAssistantMessageTx(c, tx, assistantMsg); err != nil {
		return turn, err
	}
	if turn.WasFirstTurn && strings.TrimSpace(title) != "" {
		conversation.Title = truncateRunes(strings.TrimSpace(title), 24)
	}
	conversation.UpdatedAt = now
	conversation.MessageCount = countWebMessagesFromTx(c, tx, turn.ConversationID, conversation.MessageCount)
	if err := updateWebConversationTx(c, tx, conversation); err != nil {
		return turn, err
	}
	if err := tx.Commit(); err != nil {
		return turn, err
	}
	if subjectName, _ := querySubjectName(c, db, conversation.SubjectID); subjectName != "" {
		conversation.SubjectName = subjectName
	}
	turn.Conversation = conversation
	turn.AssistantMsg = assistantMsg
	return turn, nil
}

func lockOrCreateConversation(c *gin.Context, tx *sql.Tx, conversationID string, subjectID int, userID string, now string) (webConversation, bool, error) {
	conversation, err := lockConversation(c, tx, conversationID)
	if err == nil {
		return conversation, true, nil
	}
	if err != sql.ErrNoRows {
		return webConversation{}, false, err
	}
	conversation = webConversation{
		ID:          conversationID,
		Title:       "新对话",
		SubjectID:   subjectID,
		SubjectName: "未分配学科",
		UserID:      userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if _, err := tx.ExecContext(
		c.Request.Context(),
		`INSERT INTO conversations (conversation_id, title, subject_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
		conversation.ID,
		conversation.Title,
		conversation.SubjectID,
		conversation.UserID,
	); err != nil {
		return webConversation{}, false, err
	}
	return conversation, false, nil
}

func lockConversation(c *gin.Context, tx *sql.Tx, conversationID string) (webConversation, error) {
	var item webConversation
	err := tx.QueryRowContext(
		c.Request.Context(),
		`SELECT conversation_id, title, subject_id, user_id, created_at, updated_at
		FROM conversations
		WHERE conversation_id = ?
		FOR UPDATE`,
		conversationID,
	).Scan(&item.ID, &item.Title, &item.SubjectID, &item.UserID, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func resolveConversationSubjectID(c *gin.Context, db *sql.DB, requestedSubjectID int, userID string) (int, error) {
	if requestedSubjectID > 0 {
		var id int
		err := db.QueryRowContext(c.Request.Context(), `SELECT id FROM subjects WHERE id = ?`, requestedSubjectID).Scan(&id)
		if err == nil {
			return id, nil
		}
		if err != sql.ErrNoRows {
			return 0, err
		}
	}

	if strings.TrimSpace(userID) != "" && userID != "0" {
		var id int
		err := db.QueryRowContext(
			c.Request.Context(),
			`SELECT s.id
			FROM user_subjects us
			JOIN subjects s ON s.id = us.subject_id
			WHERE us.user_id = ?
			ORDER BY us.id DESC
			LIMIT 1`,
			userID,
		).Scan(&id)
		if err == nil {
			return id, nil
		}
		if err != sql.ErrNoRows {
			return 0, err
		}
	}

	var id int
	err := db.QueryRowContext(c.Request.Context(), `SELECT id FROM subjects ORDER BY id LIMIT 1`).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func countWebMessagesTx(c *gin.Context, tx *sql.Tx, conversationID string) (int64, error) {
	var cnt int64
	err := tx.QueryRowContext(c.Request.Context(), `SELECT COUNT(1) FROM conversation_messages WHERE conversation_id = ?`, conversationID).Scan(&cnt)
	return cnt, err
}

func countWebMessagesFromTx(c *gin.Context, tx *sql.Tx, conversationID string, fallback int) int {
	cnt, err := countWebMessagesTx(c, tx, conversationID)
	if err != nil {
		return fallback
	}
	return int(cnt)
}

func insertWebMessageTx(c *gin.Context, tx *sql.Tx, item webMessage) error {
	metadataJSON := sql.NullString{}
	if item.Metadata != nil {
		raw, err := json.Marshal(item.Metadata)
		if err != nil {
			return err
		}
		metadataJSON = sql.NullString{String: string(raw), Valid: true}
	}
	_, err := tx.ExecContext(
		c.Request.Context(),
		`INSERT INTO conversation_messages
		(message_id, conversation_id, seq, turn_id, reply_to_message_id, role, status, content_inline, content_ref, content_hash, content_size, token_usage, metadata_json, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
		item.ID,
		item.ConversationID,
		item.Seq,
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

func insertWebMessageAttachmentsTx(c *gin.Context, tx *sql.Tx, messageID string, conversationID string, attachments []webMessageAttachment) error {
	for _, attachment := range normalizeMessageAttachments(attachments) {
		if attachment.ID == "" {
			attachment.ID = "att-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		}
		if attachment.Status == "" {
			attachment.Status = "done"
		}
		_, err := tx.ExecContext(
			c.Request.Context(),
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

func updateAssistantMessageTx(c *gin.Context, tx *sql.Tx, item webMessage) error {
	metadataJSON := sql.NullString{}
	if item.Metadata != nil {
		raw, err := json.Marshal(item.Metadata)
		if err != nil {
			return err
		}
		metadataJSON = sql.NullString{String: string(raw), Valid: true}
	}
	_, err := tx.ExecContext(
		c.Request.Context(),
		`UPDATE conversation_messages
		SET status = ?, content_inline = ?, content_ref = ?, content_hash = ?, content_size = ?, token_usage = ?, metadata_json = ?
		WHERE message_id = ? AND conversation_id = ?`,
		item.Status,
		item.ContentInline,
		item.ContentRef,
		item.ContentHash,
		item.ContentSize,
		item.TokenUsage,
		metadataJSON,
		item.ID,
		item.ConversationID,
	)
	return err
}

func updateWebConversationTx(c *gin.Context, tx *sql.Tx, item webConversation) error {
	_, err := tx.ExecContext(
		c.Request.Context(),
		`UPDATE conversations SET title = ?, subject_id = ?, updated_at = NOW() WHERE conversation_id = ?`,
		item.Title,
		item.SubjectID,
		item.ID,
	)
	return err
}

func prepareMessageStorage(msg *webMessage) error {
	inline := strings.TrimSpace(msg.ContentInline)
	if inline == "" {
		msg.ContentInline = ""
		msg.Content = ""
		msg.ContentSize = 0
		msg.ContentHash = ""
		return nil
	}
	contentBytes := []byte(msg.ContentInline)
	msg.ContentSize = int64(len(contentBytes))
	hash := sha256.Sum256(contentBytes)
	msg.ContentHash = hex.EncodeToString(hash[:])
	msg.Content = msg.ContentInline
	return nil
}

func rollbackQuietly(tx *sql.Tx) {
	if tx != nil {
		_ = tx.Rollback()
	}
}
