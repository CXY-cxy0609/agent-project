package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
	"tutor-server/internal/infra/objectstorage"
)

func InternalStorageUpload() gin.HandlerFunc {
	return func(c *gin.Context) {
		client, policy := getObjectStorageRuntime()
		if !policy.enabled || client == nil {
			response.Error(c, http.StatusServiceUnavailable, "OBJECT_STORAGE_UNAVAILABLE", "object storage is not enabled")
			return
		}

		fileHeader, err := c.FormFile("file")
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_FILE", "file is required")
			return
		}

		objectKey := strings.TrimSpace(c.PostForm("object_key"))
		if objectKey == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_OBJECT_KEY", "object_key is required")
			return
		}
		objectKey = strings.TrimLeft(objectKey, "/")
		contentType := strings.TrimSpace(c.PostForm("content_type"))
		if contentType == "" {
			contentType = fileHeader.Header.Get("Content-Type")
		}
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		file, err := fileHeader.Open()
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "FILE_OPEN_FAILED", "failed to open uploaded file")
			return
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "FILE_READ_FAILED", "failed to read uploaded file")
			return
		}

		result, err := client.PutBytes(c.Request.Context(), objectstorage.PutBytesInput{
			Key:         objectKey,
			Data:        data,
			ContentType: contentType,
		})
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "OBJECT_UPLOAD_FAILED", err.Error())
			return
		}

		response.OK(c, gin.H{
			"key":  result.Key,
			"url":  result.URL,
			"etag": result.ETag,
			"size": result.Size,
		})
	}
}
