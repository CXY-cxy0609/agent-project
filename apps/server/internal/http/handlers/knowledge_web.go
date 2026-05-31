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
		base := webKnowledgeBase{
			ID:          id,
			Name:        req.Name,
			SubjectID:   req.SubjectID,
			SubjectName: "未知学科",
			Type:        req.Type,
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
			`INSERT INTO knowledge_bases (knowledge_base_id, name, subject_id, type, user_id, description, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			base.ID,
			base.Name,
			base.SubjectID,
			base.Type,
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
		_, _ = db.ExecContext(c, `DELETE FROM knowledge_files WHERE knowledge_base_id = ?`, id)
		_, _ = db.ExecContext(c, `DELETE FROM knowledge_bases WHERE knowledge_base_id = ?`, id)
		response.OK(c, gin.H{"deleted": true})
	}
}

func UploadKnowledgeFile() gin.HandlerFunc {
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
		now := time.Now().UTC().Format(time.RFC3339)
		fileType := "md"
		if strings.HasSuffix(strings.ToLower(fh.Filename), ".pdf") {
			fileType = "pdf"
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		if _, err := getKnowledgeBaseByID(c, db, baseID); err != nil {
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		orderVal := nextKnowledgeFileOrder(c, db, baseID)
		file := webKnowledgeFile{
			ID:              "kf-" + strconv.FormatInt(time.Now().UnixNano(), 10),
			KnowledgeBaseID: baseID,
			Name:            fh.Filename,
			DisplayName:     fh.Filename,
			Type:            fileType,
			URL:             "/uploads/" + fh.Filename,
			Size:            fh.Size,
			Order:           orderVal,
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

func DeleteKnowledgeFile() gin.HandlerFunc {
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
		_, _ = db.ExecContext(c, `DELETE FROM knowledge_files WHERE knowledge_base_id = ? AND file_id = ?`, baseID, fileID)
		_, _ = db.ExecContext(c, `UPDATE knowledge_bases SET updated_at = NOW() WHERE knowledge_base_id = ?`, baseID)
		response.OK(c, gin.H{"deleted": true})
	}
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
	query := `SELECT kb.knowledge_base_id, kb.name, kb.subject_id, COALESCE(s.name, '未知学科') AS subject_name,
		kb.type, kb.user_id, kb.description, kb.created_at, kb.updated_at
		FROM knowledge_bases kb
		LEFT JOIN subjects s ON s.subject_id = kb.subject_id
		WHERE 1=1`
	args := []any{}
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
		LEFT JOIN subjects s ON s.subject_id = kb.subject_id
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
