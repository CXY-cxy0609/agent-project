package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
	"tutor-server/internal/infra/objectstorage"
)

const (
	maxChatAttachmentBytes = 20 << 20
	maxChatAttachmentCount = 10
)

var allowedChatAttachmentTypes = map[string]struct{}{
	"application/pdf": {},
	"text/markdown":   {},
	"text/plain":      {},
}

type chatAttachmentResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
	MimeType     string `json:"mimeType,omitempty"`
	StorageKey   string `json:"storageKey,omitempty"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
	Hash         string `json:"hash,omitempty"`
	Status       string `json:"status,omitempty"`
}

func UploadChatAttachment() gin.HandlerFunc {
	return func(c *gin.Context) {
		fileHeader, err := c.FormFile("file")
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_FILE", "file is required")
			return
		}
		if fileHeader.Size <= 0 {
			response.Error(c, http.StatusBadRequest, "EMPTY_FILE", "file is empty")
			return
		}
		if fileHeader.Size > maxChatAttachmentBytes {
			response.Error(c, http.StatusBadRequest, "FILE_TOO_LARGE", "file exceeds 20MB limit")
			return
		}

		file, err := fileHeader.Open()
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "FILE_OPEN_FAILED", "failed to open uploaded file")
			return
		}
		defer file.Close()

		data, err := io.ReadAll(io.LimitReader(file, maxChatAttachmentBytes+1))
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "FILE_READ_FAILED", "failed to read uploaded file")
			return
		}
		if int64(len(data)) > maxChatAttachmentBytes {
			response.Error(c, http.StatusBadRequest, "FILE_TOO_LARGE", "file exceeds 20MB limit")
			return
		}

		contentType := detectChatAttachmentContentType(fileHeader.Filename, fileHeader.Header.Get("Content-Type"), data)
		attachmentType := classifyChatAttachment(contentType, fileHeader.Filename)
		if attachmentType == "" {
			response.Error(c, http.StatusBadRequest, "UNSUPPORTED_FILE_TYPE", "only images are supported in chat attachments")
			return
		}

		hashBytes := sha256.Sum256(data)
		hash := hex.EncodeToString(hashBytes[:])
		id := "att-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		objectKey := buildChatAttachmentKey(id, fileHeader.Filename)
		url, storageKey, err := storeChatAttachment(c, objectKey, contentType, data)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ATTACHMENT_UPLOAD_FAILED", "failed to upload attachment")
			return
		}

		response.Created(c, gin.H{
			"attachment": chatAttachmentResponse{
				ID:           id,
				Name:         sanitizeAttachmentName(fileHeader.Filename),
				URL:          url,
				Type:         attachmentType,
				Size:         int64(len(data)),
				MimeType:     contentType,
				StorageKey:   storageKey,
				ThumbnailURL: thumbnailURLForAttachment(attachmentType, url),
				Hash:         hash,
				Status:       "done",
			},
		})
	}
}

func detectChatAttachmentContentType(filename string, headerContentType string, data []byte) string {
	contentType := strings.TrimSpace(strings.Split(headerContentType, ";")[0])
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = strings.TrimSpace(mime.TypeByExtension(strings.ToLower(filepath.Ext(filename))))
	}
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = http.DetectContentType(data)
	}
	if contentType == "text/x-markdown" {
		return "text/markdown"
	}
	return contentType
}

func classifyChatAttachment(contentType string, filename string) string {
	normalized := strings.ToLower(strings.TrimSpace(contentType))
	if strings.HasPrefix(normalized, "image/") {
		return "image"
	}
	// Keep document classification isolated so PDF/MD support can be enabled without changing the API contract.
	return ""
}

func classifyDocumentAttachment(contentType string, filename string) string {
	normalized := strings.ToLower(strings.TrimSpace(contentType))
	ext := strings.ToLower(filepath.Ext(filename))
	if normalized == "application/pdf" || ext == ".pdf" {
		return "pdf"
	}
	if _, ok := allowedChatAttachmentTypes[normalized]; ok {
		return "file"
	}
	if ext == ".md" || ext == ".markdown" || ext == ".txt" {
		return "file"
	}
	return ""
}

func buildChatAttachmentKey(id string, filename string) string {
	_, policy := getObjectStorageRuntime()
	prefix := strings.Trim(strings.TrimSpace(policy.pathPrefix), "/")
	if prefix == "" {
		prefix = "chat"
	}
	ext := strings.ToLower(filepath.Ext(filename))
	return path.Join(prefix, "attachments", time.Now().UTC().Format("20060102"), id+ext)
}

func storeChatAttachment(c *gin.Context, objectKey string, contentType string, data []byte) (string, string, error) {
	client, policy := getObjectStorageRuntime()
	if policy.enabled && client != nil {
		result, err := client.PutBytes(c.Request.Context(), objectstorage.PutBytesInput{
			Key:         objectKey,
			Data:        data,
			ContentType: contentType,
		})
		if err != nil {
			return "", "", err
		}
		return result.URL, result.Key, nil
	}

	localPath := filepath.Join("uploads", filepath.FromSlash(objectKey))
	if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
		return "", "", err
	}
	if err := os.WriteFile(localPath, data, 0o644); err != nil {
		return "", "", err
	}
	return "/" + filepath.ToSlash(localPath), objectKey, nil
}

func thumbnailURLForAttachment(attachmentType string, url string) string {
	if attachmentType == "image" {
		return url
	}
	return ""
}

func sanitizeAttachmentName(filename string) string {
	name := strings.TrimSpace(filepath.Base(filename))
	if name == "." || name == string(filepath.Separator) || name == "" {
		return fmt.Sprintf("attachment-%d", time.Now().UnixNano())
	}
	return name
}
