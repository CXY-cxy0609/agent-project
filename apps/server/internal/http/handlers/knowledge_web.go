package handlers

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

type createKnowledgeBaseReq struct {
	Name        string `json:"name"`
	SubjectID   int    `json:"subjectId"`
	Type        string `json:"type"`
	Description string `json:"description"`
}

type listKnowledgeBaseReq struct {
	SubjectID *int   `json:"subjectId"`
	Name      string `json:"name"`
	Type      string `json:"type"`
}

type identifyKnowledgeBaseReq struct {
	ID string `json:"id"`
}

type updateKnowledgeBaseReq struct {
	ID          string  `json:"id"`
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

type updateKnowledgeFileReq struct {
	KnowledgeBaseID string  `json:"knowledgeBaseId"`
	FileID          string  `json:"fileId"`
	DisplayName     *string `json:"displayName"`
	Content         *string `json:"content"`
	Order           *int    `json:"order"`
}

type reorderKnowledgeFileReq struct {
	KnowledgeBaseID string   `json:"knowledgeBaseId"`
	FileIDs         []string `json:"fileIds"`
}

type identifyKnowledgeFileReq struct {
	KnowledgeBaseID string `json:"knowledgeBaseId"`
	FileID          string `json:"fileId"`
}

func ListKnowledgeBases() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req listKnowledgeBaseReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid knowledge list body")
			return
		}

		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		list, err := queryKnowledgeBases(c, db, req)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_LIST_FAILED", "failed to list knowledge bases")
			return
		}
		sort.Slice(list, func(i, j int) bool {
			return list[i].UpdatedAt > list[j].UpdatedAt
		})
		response.OK(c, gin.H{"list": list})
	}
}

func GetKnowledgeBase() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifyKnowledgeBaseReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid knowledge base detail body")
			return
		}
		id := req.ID
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		base, err := getKnowledgeBaseByID(c, db, id)
		if err != nil {
			if err == sql.ErrNoRows {
				response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
				return
			}
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_QUERY_FAILED", "failed to query knowledge base")
			return
		}
		if base.ID == "" {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		userID, _ := latestUserID(c, db)
		if !canAccessKnowledgeBase(base, userID) {
			response.Error(c, http.StatusForbidden, "KNOWLEDGE_BASE_FORBIDDEN", "knowledge base is not accessible")
			return
		}
		response.OK(c, gin.H{
			"id":          base.ID,
			"name":        base.Name,
			"subjectId":   base.SubjectID,
			"subjectName": base.SubjectName,
			"type":        base.Type,
			"userId":      base.UserID,
			"description": base.Description,
			"files":       base.Files,
			"createdAt":   base.CreatedAt,
			"updatedAt":   base.UpdatedAt,
		})
	}
}

func CreateKnowledgeBase() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createKnowledgeBaseReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid knowledge base body")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		id := "kb-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, _ := latestUserID(c, db)
		if userID == "" {
			userID = "0"
		}
		visibility := req.Type
		if visibility != "private" {
			visibility = "public"
		}
		base := webKnowledgeBase{
			ID:          id,
			Name:        req.Name,
			SubjectID:   req.SubjectID,
			SubjectName: "未知学科",
			Type:        visibility,
			UserID:      userID,
			Description: req.Description,
			Files:       []webKnowledgeFile{},
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if name, err := querySubjectName(c, db, req.SubjectID); err == nil && name != "" {
			base.SubjectName = name
		}
		_, err := db.ExecContext(
			c,
			`INSERT INTO knowledge_bases (knowledge_base_id, tenant_id, name, subject_id, type, visibility, user_id, owner_user_id, description, created_at, updated_at)
			 VALUES (?, 'public', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			base.ID,
			base.Name,
			base.SubjectID,
			base.Type,
			visibility,
			base.UserID,
			base.UserID,
			base.Description,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_CREATE_FAILED", "failed to create knowledge base")
			return
		}
		response.Created(c, gin.H{"knowledgeBase": base})
	}
}

func UpdateKnowledgeBase() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req updateKnowledgeBaseReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid knowledge base body")
			return
		}
		id := req.ID
		if id == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_KNOWLEDGE_BASE_ID", "id is required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		base, err := getKnowledgeBaseByID(c, db, id)
		if err != nil {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		userID, _ := latestUserID(c, db)
		if !canAccessKnowledgeBase(base, userID) {
			response.Error(c, http.StatusForbidden, "KNOWLEDGE_BASE_FORBIDDEN", "knowledge base is not accessible")
			return
		}
		if req.Name != nil {
			base.Name = *req.Name
		}
		if req.Description != nil {
			base.Description = *req.Description
		}
		base.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		_, err = db.ExecContext(
			c,
			`UPDATE knowledge_bases SET name = ?, description = ?, updated_at = NOW() WHERE knowledge_base_id = ?`,
			base.Name,
			base.Description,
			base.ID,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_UPDATE_FAILED", "failed to update knowledge base")
			return
		}
		response.OK(c, gin.H{"knowledgeBase": base})
	}
}

func DeleteKnowledgeBase() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifyKnowledgeBaseReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid knowledge base delete body")
			return
		}
		id := req.ID
		if id == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_KNOWLEDGE_BASE_ID", "id is required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		base, err := getKnowledgeBaseByID(c, db, id)
		if err != nil {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		userID, _ := latestUserID(c, db)
		if !canAccessKnowledgeBase(base, userID) {
			response.Error(c, http.StatusForbidden, "KNOWLEDGE_BASE_FORBIDDEN", "knowledge base is not accessible")
			return
		}
		_, _ = db.ExecContext(c, `DELETE FROM knowledge_files WHERE knowledge_base_id = ?`, id)
		_, _ = db.ExecContext(c, `DELETE FROM knowledge_bases WHERE knowledge_base_id = ?`, id)
		response.OK(c, gin.H{"deleted": true})
	}
}

const maxKnowledgeFileBytes = 100 << 20

func UploadKnowledgeFile(ragServiceURL string, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		baseID := c.PostForm("knowledgeBaseId")
		if baseID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_KNOWLEDGE_BASE_ID", "knowledgeBaseId is required")
			return
		}
		fh, err := c.FormFile("file")
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_FILE", "file is required")
			return
		}
		if fh.Size <= 0 {
			response.Error(c, http.StatusBadRequest, "EMPTY_FILE", "file is empty")
			return
		}
		if fh.Size > maxKnowledgeFileBytes {
			response.Error(c, http.StatusBadRequest, "FILE_TOO_LARGE", "file exceeds 100MB limit")
			return
		}
		uploadedFile, err := fh.Open()
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "FILE_OPEN_FAILED", "failed to open uploaded file")
			return
		}
		defer uploadedFile.Close()
		data, err := io.ReadAll(io.LimitReader(uploadedFile, maxKnowledgeFileBytes+1))
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "FILE_READ_FAILED", "failed to read uploaded file")
			return
		}
		if int64(len(data)) > maxKnowledgeFileBytes {
			response.Error(c, http.StatusBadRequest, "FILE_TOO_LARGE", "file exceeds 100MB limit")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		contentType := detectKnowledgeFileContentType(fh.Filename, fh.Header.Get("Content-Type"), data)
		fileType := classifyKnowledgeFileType(contentType, fh.Filename)
		if fileType == "" {
			response.Error(c, http.StatusBadRequest, "UNSUPPORTED_FILE_TYPE", "unsupported knowledge file type")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		base, err := getKnowledgeBaseByID(c, db, baseID)
		if err != nil {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		userID, _ := latestUserID(c, db)
		if !canAccessKnowledgeBase(base, userID) {
			response.Error(c, http.StatusForbidden, "KNOWLEDGE_BASE_FORBIDDEN", "knowledge base is not accessible")
			return
		}
		fileID := "kf-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		objectKey := buildKnowledgeFileObjectKey(baseID, fileID, fh.Filename)
		url, storageKey, err := storeChatAttachment(c, objectKey, contentType, data)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_OBJECT_UPLOAD_FAILED", "failed to upload knowledge file object")
			return
		}
		if err := submitKnowledgeFileToRAG(
			c,
			ragServiceURL,
			internalToken,
			base,
			fileID,
			fh.Filename,
			contentType,
			data,
		); err != nil {
			response.Error(c, http.StatusBadGateway, "KNOWLEDGE_RAG_INDEX_FAILED", err.Error())
			return
		}
		orderVal := nextKnowledgeFileOrder(c, db, baseID)
		hashBytes := sha256.Sum256(data)
		file := webKnowledgeFile{
			ID:              fileID,
			KnowledgeBaseID: baseID,
			Name:            fh.Filename,
			DisplayName:     fh.Filename,
			Type:            fileType,
			URL:             url,
			Size:            int64(len(data)),
			Order:           orderVal,
			StorageKey:      storageKey,
			MimeType:        contentType,
			Hash:            hex.EncodeToString(hashBytes[:]),
			Status:          "done",
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		_, err = db.ExecContext(
			c,
			`INSERT INTO knowledge_files
			(file_id, knowledge_base_id, name, display_name, type, url, size, file_order, content, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', NOW(), NOW())`,
			file.ID,
			file.KnowledgeBaseID,
			file.Name,
			file.DisplayName,
			file.Type,
			file.URL,
			file.Size,
			file.Order,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_FILE_CREATE_FAILED", "failed to upload file")
			return
		}
		_, _ = db.ExecContext(c, `UPDATE knowledge_bases SET updated_at = ? WHERE knowledge_base_id = ?`, now, baseID)

		response.Created(c, gin.H{"file": file})
	}
}

func detectKnowledgeFileContentType(filename string, headerContentType string, data []byte) string {
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

func classifyKnowledgeFileType(contentType string, filename string) string {
	normalized := strings.ToLower(strings.TrimSpace(contentType))
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".pdf":
		return "pdf"
	case ".md", ".markdown":
		return "md"
	case ".txt":
		return "txt"
	case ".docx":
		return "docx"
	case ".pptx":
		return "pptx"
	case ".xlsx":
		return "xlsx"
	case ".csv":
		return "csv"
	case ".html", ".htm":
		return "html"
	}
	if normalized == "application/pdf" {
		return "pdf"
	}
	if strings.Contains(normalized, "markdown") {
		return "md"
	}
	if strings.HasPrefix(normalized, "text/") {
		return "txt"
	}
	return ""
}

func buildKnowledgeFileObjectKey(baseID string, fileID string, filename string) string {
	_, policy := getObjectStorageRuntime()
	prefix := strings.Trim(strings.TrimSpace(policy.pathPrefix), "/")
	if prefix == "" {
		prefix = "knowledge"
	}
	ext := strings.ToLower(filepath.Ext(filename))
	return path.Join(prefix, "knowledge-bases", baseID, time.Now().UTC().Format("20060102"), fileID+ext)
}

func submitKnowledgeFileToRAG(
	c *gin.Context,
	ragServiceURL string,
	internalToken string,
	base webKnowledgeBase,
	fileID string,
	filename string,
	contentType string,
	data []byte,
) error {
	ragURL := strings.TrimRight(strings.TrimSpace(ragServiceURL), "/")
	if ragURL == "" {
		return fmt.Errorf("RAG service URL is not configured")
	}
	if strings.TrimSpace(internalToken) == "" {
		return fmt.Errorf("internal token is not configured")
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fields := map[string]string{
		"knowledge_base_id": base.ID,
		"subject_id":        strconv.Itoa(base.SubjectID),
		"doc_name":          filename,
		"visibility":        base.Type,
		"owner_user_id":     base.UserID,
		"doc_id":            fileID,
		"wait":              "false",
		"mode":              "balanced",
	}
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			return err
		}
	}
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return err
	}
	if _, err := part.Write(data); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, ragURL+"/index/upload", &body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("x-internal-token", internalToken)
	if contentType != "" {
		req.Header.Set("x-file-content-type", contentType)
	}
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("RAG index upload failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}

func UpdateKnowledgeFile() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req updateKnowledgeFileReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid file body")
			return
		}
		baseID := req.KnowledgeBaseID
		fileID := req.FileID
		if baseID == "" || fileID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_KNOWLEDGE_FILE_ID", "knowledgeBaseId and fileId are required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		file, err := getKnowledgeFileByID(c, db, baseID, fileID)
		if err != nil {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_FILE_NOT_FOUND", "knowledge file not found")
			return
		}
		if req.DisplayName != nil {
			file.DisplayName = *req.DisplayName
		}
		if req.Content != nil {
			file.Content = *req.Content
		}
		if req.Order != nil {
			file.Order = *req.Order
		}
		file.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		_, err = db.ExecContext(
			c,
			`UPDATE knowledge_files SET display_name = ?, content = ?, file_order = ?, updated_at = NOW() WHERE knowledge_base_id = ? AND file_id = ?`,
			file.DisplayName,
			file.Content,
			file.Order,
			baseID,
			fileID,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_FILE_UPDATE_FAILED", "failed to update file")
			return
		}
		_, _ = db.ExecContext(c, `UPDATE knowledge_bases SET updated_at = ? WHERE knowledge_base_id = ?`, file.UpdatedAt, baseID)

		response.OK(c, gin.H{"file": file})
	}
}

func DeleteKnowledgeFile(ragServiceURL string, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifyKnowledgeFileReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid file delete body")
			return
		}
		baseID := req.KnowledgeBaseID
		fileID := req.FileID
		if baseID == "" || fileID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_KNOWLEDGE_FILE_ID", "knowledgeBaseId and fileId are required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		base, err := getKnowledgeBaseByID(c, db, baseID)
		if err != nil {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		userID, _ := latestUserID(c, db)
		if !canAccessKnowledgeBase(base, userID) {
			response.Error(c, http.StatusForbidden, "KNOWLEDGE_BASE_FORBIDDEN", "knowledge base is not accessible")
			return
		}
		if _, err := getKnowledgeFileByID(c, db, baseID, fileID); err != nil {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_FILE_NOT_FOUND", "knowledge file not found")
			return
		}
		if err := deleteKnowledgeFileFromRAG(c, ragServiceURL, internalToken, baseID, fileID); err != nil {
			response.Error(c, http.StatusBadGateway, "KNOWLEDGE_RAG_DELETE_FAILED", err.Error())
			return
		}
		_, _ = db.ExecContext(c, `DELETE FROM knowledge_files WHERE knowledge_base_id = ? AND file_id = ?`, baseID, fileID)
		_, _ = db.ExecContext(c, `UPDATE knowledge_bases SET updated_at = NOW() WHERE knowledge_base_id = ?`, baseID)
		response.OK(c, gin.H{"deleted": true})
	}
}

func deleteKnowledgeFileFromRAG(c *gin.Context, ragServiceURL string, internalToken string, knowledgeBaseID string, fileID string) error {
	ragURL := strings.TrimRight(strings.TrimSpace(ragServiceURL), "/")
	if ragURL == "" {
		return fmt.Errorf("RAG service URL is not configured")
	}
	if strings.TrimSpace(internalToken) == "" {
		return fmt.Errorf("internal token is not configured")
	}
	req, err := http.NewRequestWithContext(
		c.Request.Context(),
		http.MethodDelete,
		ragURL+"/index/"+knowledgeBaseID+"/"+fileID,
		nil,
	)
	if err != nil {
		return err
	}
	req.Header.Set("x-internal-token", internalToken)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("RAG index delete failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return nil
}

func ReorderKnowledgeFiles() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req reorderKnowledgeFileReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid reorder body")
			return
		}
		baseID := req.KnowledgeBaseID
		if baseID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_KNOWLEDGE_BASE_ID", "knowledgeBaseId is required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		orderMap := map[string]int{}
		for idx, id := range req.FileIDs {
			orderMap[id] = idx + 1
		}
		for fileID, ord := range orderMap {
			_, _ = db.ExecContext(
				c,
				`UPDATE knowledge_files SET file_order = ?, updated_at = NOW() WHERE knowledge_base_id = ? AND file_id = ?`,
				ord,
				baseID,
				fileID,
			)
		}
		_, _ = db.ExecContext(c, `UPDATE knowledge_bases SET updated_at = NOW() WHERE knowledge_base_id = ?`, baseID)
		response.OK(c, gin.H{"updated": true})
	}
}

func GetKnowledgeFileContent() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifyKnowledgeFileReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid file content body")
			return
		}
		baseID := req.KnowledgeBaseID
		fileID := req.FileID
		if baseID == "" || fileID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_KNOWLEDGE_FILE_ID", "knowledgeBaseId and fileId are required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		var content string
		err := db.QueryRowContext(
			c,
			`SELECT content FROM knowledge_files WHERE knowledge_base_id = ? AND file_id = ?`,
			baseID,
			fileID,
		).Scan(&content)
		if err == sql.ErrNoRows {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_FILE_NOT_FOUND", "knowledge file not found")
			return
		}
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "KNOWLEDGE_FILE_QUERY_FAILED", "failed to query knowledge file")
			return
		}
		response.OK(c, gin.H{"content": content})
	}
}

func queryKnowledgeBases(c *gin.Context, db *sql.DB, req listKnowledgeBaseReq) ([]webKnowledgeBase, error) {
	userID, _ := latestUserID(c, db)
	query := `SELECT kb.knowledge_base_id, kb.name, kb.subject_id, COALESCE(s.name, '未知学科') AS subject_name,
		kb.type, kb.user_id, kb.description, kb.created_at, kb.updated_at
		FROM knowledge_bases kb
		LEFT JOIN subjects s ON s.id = kb.subject_id
		WHERE (kb.visibility = 'public' OR (kb.visibility = 'private' AND kb.owner_user_id = ?))`
	args := []any{userID}
	if req.SubjectID != nil && *req.SubjectID > 0 {
		query += ` AND kb.subject_id = ?`
		args = append(args, *req.SubjectID)
	}
	if strings.TrimSpace(req.Type) != "" {
		query += ` AND kb.type = ?`
		args = append(args, req.Type)
	}
	if strings.TrimSpace(req.Name) != "" {
		query += ` AND kb.name LIKE ?`
		args = append(args, "%"+req.Name+"%")
	}
	query += ` ORDER BY kb.updated_at DESC, kb.id DESC`
	rows, err := db.QueryContext(c, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]webKnowledgeBase, 0, 32)
	for rows.Next() {
		var item webKnowledgeBase
		if err := rows.Scan(&item.ID, &item.Name, &item.SubjectID, &item.SubjectName, &item.Type, &item.UserID, &item.Description, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.Files, _ = queryKnowledgeFiles(c, db, item.ID)
		list = append(list, item)
	}
	return list, rows.Err()
}

func getKnowledgeBaseByID(c *gin.Context, db *sql.DB, id string) (webKnowledgeBase, error) {
	var item webKnowledgeBase
	err := db.QueryRowContext(
		c,
		`SELECT kb.knowledge_base_id, kb.name, kb.subject_id, COALESCE(s.name, '未知学科') AS subject_name,
		kb.type, kb.user_id, kb.description, kb.created_at, kb.updated_at
		FROM knowledge_bases kb
		LEFT JOIN subjects s ON s.id = kb.subject_id
		WHERE kb.knowledge_base_id = ?`,
		id,
	).Scan(&item.ID, &item.Name, &item.SubjectID, &item.SubjectName, &item.Type, &item.UserID, &item.Description, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return webKnowledgeBase{}, err
	}
	item.Files, _ = queryKnowledgeFiles(c, db, item.ID)
	return item, nil
}

func queryKnowledgeFiles(c *gin.Context, db *sql.DB, baseID string) ([]webKnowledgeFile, error) {
	rows, err := db.QueryContext(
		c,
		`SELECT file_id, knowledge_base_id, name, display_name, type, url, size, file_order, content, created_at, updated_at
		FROM knowledge_files
		WHERE knowledge_base_id = ?
		ORDER BY file_order ASC, id ASC`,
		baseID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]webKnowledgeFile, 0, 16)
	for rows.Next() {
		var item webKnowledgeFile
		if err := rows.Scan(&item.ID, &item.KnowledgeBaseID, &item.Name, &item.DisplayName, &item.Type, &item.URL, &item.Size, &item.Order, &item.Content, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func getKnowledgeFileByID(c *gin.Context, db *sql.DB, baseID, fileID string) (webKnowledgeFile, error) {
	var item webKnowledgeFile
	err := db.QueryRowContext(
		c,
		`SELECT file_id, knowledge_base_id, name, display_name, type, url, size, file_order, content, created_at, updated_at
		FROM knowledge_files
		WHERE knowledge_base_id = ? AND file_id = ?`,
		baseID,
		fileID,
	).Scan(&item.ID, &item.KnowledgeBaseID, &item.Name, &item.DisplayName, &item.Type, &item.URL, &item.Size, &item.Order, &item.Content, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return webKnowledgeFile{}, err
	}
	return item, nil
}

func nextKnowledgeFileOrder(c *gin.Context, db *sql.DB, baseID string) int {
	var order sql.NullInt64
	_ = db.QueryRowContext(c, `SELECT MAX(file_order) FROM knowledge_files WHERE knowledge_base_id = ?`, baseID).Scan(&order)
	if !order.Valid {
		return 1
	}
	return int(order.Int64) + 1
}

func canAccessKnowledgeBase(base webKnowledgeBase, userID string) bool {
	if base.Type != "private" {
		return true
	}
	return base.UserID != "" && base.UserID == userID
}
