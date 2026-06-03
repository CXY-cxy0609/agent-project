package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"io"
	"net/http"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

const maxAssessmentAnswerImageBytes = 10 << 20

func UploadAssessmentAnswerAttachment() gin.HandlerFunc {
	return func(c *gin.Context) {
		assessmentID := strings.TrimSpace(c.PostForm("assessmentId"))
		questionID := strings.TrimSpace(c.PostForm("questionId"))
		if assessmentID == "" || questionID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_ATTACHMENT_CONTEXT", "assessmentId and questionId are required")
			return
		}
		fileHeader, err := c.FormFile("file")
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_FILE", "file is required")
			return
		}
		if fileHeader.Size <= 0 || fileHeader.Size > maxAssessmentAnswerImageBytes {
			response.Error(c, http.StatusBadRequest, "INVALID_FILE_SIZE", "image must be between 1 byte and 10MB")
			return
		}
		file, err := fileHeader.Open()
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "FILE_OPEN_FAILED", "failed to open uploaded file")
			return
		}
		defer file.Close()
		data, err := io.ReadAll(io.LimitReader(file, maxAssessmentAnswerImageBytes+1))
		if err != nil || int64(len(data)) > maxAssessmentAnswerImageBytes {
			response.Error(c, http.StatusBadRequest, "FILE_READ_FAILED", "failed to read uploaded file")
			return
		}
		contentType := detectChatAttachmentContentType(fileHeader.Filename, fileHeader.Header.Get("Content-Type"), data)
		if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
			response.Error(c, http.StatusBadRequest, "UNSUPPORTED_FILE_TYPE", "only image answers are supported")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, _ := latestUserID(c, db)
		if err := ensureAssessmentQuestion(c, db, assessmentID, questionID); err != nil {
			response.Error(c, http.StatusNotFound, "ASSESSMENT_QUESTION_NOT_FOUND", "assessment question not found")
			return
		}
		hashBytes := sha256.Sum256(data)
		hash := hex.EncodeToString(hashBytes[:])
		attachmentID := "att-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		objectKey := buildAssessmentAttachmentKey(attachmentID, assessmentID, questionID, fileHeader.Filename)
		url, storageKey, err := storeChatAttachment(c, objectKey, contentType, data)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ATTACHMENT_UPLOAD_FAILED", "failed to upload attachment")
			return
		}
		_, err = db.ExecContext(
			c,
			`INSERT INTO assessment_answer_attachments
			(attachment_id, assessment_id, question_id, user_id, name, mime_type, size, url, storage_key, hash, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'done', NOW())`,
			attachmentID,
			assessmentID,
			questionID,
			userID,
			sanitizeAttachmentName(fileHeader.Filename),
			contentType,
			int64(len(data)),
			url,
			storageKey,
			hash,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ATTACHMENT_RECORD_FAILED", "failed to save attachment")
			return
		}
		response.Created(c, gin.H{"attachment": gin.H{
			"id":           attachmentID,
			"name":         sanitizeAttachmentName(fileHeader.Filename),
			"url":          url,
			"type":         "image",
			"size":         int64(len(data)),
			"mimeType":     contentType,
			"storageKey":   storageKey,
			"thumbnailUrl": url,
			"hash":         hash,
			"status":       "done",
		}})
	}
}

func ensureAssessmentQuestion(c *gin.Context, db *sql.DB, assessmentID string, questionID string) error {
	var id string
	return db.QueryRowContext(
		c,
		`SELECT question_id FROM assessment_questions WHERE assessment_id = ? AND question_id = ?`,
		assessmentID,
		questionID,
	).Scan(&id)
}

func buildAssessmentAttachmentKey(attachmentID string, assessmentID string, questionID string, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	return path.Join("assessment", "answers", time.Now().UTC().Format("20060102"), assessmentID, questionID, attachmentID+ext)
}
