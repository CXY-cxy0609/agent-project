package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/infra/objectstorage"
)

func enrichMessageStorage(c *gin.Context, db *sql.DB, msg *webMessage) error {
	if msg == nil {
		return nil
	}
	if msg.Role == "assistant" && (msg.TurnID == "" || msg.ReplyToID == "") {
		turnID, replyToID, err := inferAssistantTurnAndReply(c, db, msg.ConversationID)
		if err != nil {
			return err
		}
		if msg.TurnID == "" {
			msg.TurnID = turnID
		}
		if msg.ReplyToID == "" {
			msg.ReplyToID = replyToID
		}
	}

	inline := strings.TrimSpace(msg.ContentInline)
	if inline == "" && strings.TrimSpace(msg.ContentRef) == "" {
		msg.ContentInline = ""
		msg.ContentSize = 0
		msg.ContentHash = ""
		msg.Content = ""
		return nil
	}

	if inline == "" && strings.TrimSpace(msg.ContentRef) != "" {
		if msg.ContentSize < 0 {
			msg.ContentSize = 0
		}
		msg.Content = resolveWebMessageContent(*msg)
		return nil
	}

	contentBytes := []byte(msg.ContentInline)
	msg.ContentSize = int64(len(contentBytes))
	hash := sha256.Sum256(contentBytes)
	msg.ContentHash = hex.EncodeToString(hash[:])

	client, policy := getObjectStorageRuntime()
	shouldExternalize := policy.enabled && client != nil && msg.ContentSize >= int64(policy.externalizeMinBytes)
	if !shouldExternalize {
		msg.ContentInline = truncateUTF8ByBytes(msg.ContentInline, policy.inlineMaxBytes)
		msg.Content = resolveWebMessageContent(*msg)
		return nil
	}

	objectKey := buildExternalContentObjectKey(policy.pathPrefix, msg.ConversationID, msg.ID, msg.ContentHash)
	result, err := client.PutText(c.Request.Context(), objectstorage.PutTextInput{
		Key:         objectKey,
		Content:     msg.ContentInline,
		ContentType: "text/plain; charset=utf-8",
	})
	if err != nil {
		return fmt.Errorf("upload external message content failed: %w", err)
	}
	msg.ContentRef = result.Key
	msg.ContentInline = truncateUTF8ByBytes(msg.ContentInline, policy.inlineMaxBytes)
	msg.Content = resolveWebMessageContent(*msg)
	return nil
}

func inferAssistantTurnAndReply(c *gin.Context, db *sql.DB, conversationID string) (string, string, error) {
	if strings.TrimSpace(conversationID) == "" {
		return "", "", nil
	}
	var messageID string
	var turnID string
	err := db.QueryRowContext(
		c,
		`SELECT message_id, COALESCE(turn_id, '')
		FROM conversation_messages
		WHERE conversation_id = ? AND role = 'user'
		ORDER BY seq DESC, id DESC
		LIMIT 1`,
		conversationID,
	).Scan(&messageID, &turnID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", "", nil
		}
		return "", "", err
	}
	return turnID, messageID, nil
}

func truncateUTF8ByBytes(input string, maxBytes int) string {
	if maxBytes <= 0 {
		return input
	}
	data := []byte(input)
	if len(data) <= maxBytes {
		return input
	}
	data = data[:maxBytes]
	for len(data) > 0 && (data[len(data)-1]&0xC0) == 0x80 {
		data = data[:len(data)-1]
	}
	return string(data)
}

func buildExternalContentObjectKey(prefix string, conversationID string, messageID string, hash string) string {
	datePath := time.Now().UTC().Format("2006/01/02")
	trimmedPrefix := strings.Trim(strings.TrimSpace(prefix), "/")
	if trimmedPrefix == "" {
		trimmedPrefix = "chat"
	}
	conv := strings.TrimSpace(conversationID)
	if conv == "" {
		conv = "unknown-conversation"
	}
	msg := strings.TrimSpace(messageID)
	if msg == "" {
		msg = fmt.Sprintf("msg-%d", time.Now().UnixNano())
	}
	shortHash := hash
	if len(shortHash) > 12 {
		shortHash = shortHash[:12]
	}
	return fmt.Sprintf("%s/%s/%s/%s-%s.txt", trimmedPrefix, datePath, conv, msg, shortHash)
}
