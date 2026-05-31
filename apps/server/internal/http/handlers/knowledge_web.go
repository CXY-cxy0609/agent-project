package handlers

import (
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

type updateKnowledgeBaseReq struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

type updateKnowledgeFileReq struct {
	DisplayName *string `json:"displayName"`
	Content     *string `json:"content"`
	Order       *int    `json:"order"`
}

type reorderKnowledgeFileReq struct {
	FileIDs []string `json:"fileIds"`
}

func ListKnowledgeBases() gin.HandlerFunc {
	return func(c *gin.Context) {
		subjectID, _ := strconv.Atoi(c.Query("subjectId"))
		name := c.Query("name")
		baseType := c.Query("type")

		state.mu.RLock()
		list := make([]webKnowledgeBase, 0, len(state.knowledge))
		for _, item := range state.knowledge {
			if subjectID > 0 && item.SubjectID != subjectID {
				continue
			}
			if baseType != "" && item.Type != baseType {
				continue
			}
			if !filterIncludes(item.Name, name) {
				continue
			}
			list = append(list, item)
		}
		state.mu.RUnlock()
		sort.Slice(list, func(i, j int) bool {
			return list[i].UpdatedAt > list[j].UpdatedAt
		})
		response.OK(c, gin.H{"list": list})
	}
}

func GetKnowledgeBase() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		state.mu.RLock()
		base, ok := state.knowledge[id]
		state.mu.RUnlock()
		if !ok {
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
		base := webKnowledgeBase{
			ID:          id,
			Name:        req.Name,
			SubjectID:   req.SubjectID,
			SubjectName: "未知学科",
			Type:        req.Type,
			UserID:      "mock-user-001",
			Description: req.Description,
			Files:       []webKnowledgeFile{},
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		state.mu.Lock()
		base.SubjectName = subjectNameByID(state.subjects, req.SubjectID)
		state.knowledge[id] = base
		state.mu.Unlock()
		response.Created(c, gin.H{"knowledgeBase": base})
	}
}

func UpdateKnowledgeBase() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req updateKnowledgeBaseReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid knowledge base body")
			return
		}
		state.mu.Lock()
		base, ok := state.knowledge[id]
		if !ok {
			state.mu.Unlock()
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
		state.knowledge[id] = base
		state.mu.Unlock()
		response.OK(c, gin.H{"knowledgeBase": base})
	}
}

func DeleteKnowledgeBase() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		state.mu.Lock()
		delete(state.knowledge, id)
		state.mu.Unlock()
		response.OK(c, gin.H{"deleted": true})
	}
}

func UploadKnowledgeFile() gin.HandlerFunc {
	return func(c *gin.Context) {
		baseID := c.Param("id")
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

		state.mu.Lock()
		base, ok := state.knowledge[baseID]
		if !ok {
			state.mu.Unlock()
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		file := webKnowledgeFile{
			ID:              "kf-" + strconv.FormatInt(time.Now().UnixNano(), 10),
			KnowledgeBaseID: baseID,
			Name:            fh.Filename,
			DisplayName:     fh.Filename,
			Type:            fileType,
			URL:             "/uploads/" + fh.Filename,
			Size:            fh.Size,
			Order:           len(base.Files) + 1,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		base.Files = append(base.Files, file)
		base.UpdatedAt = now
		state.knowledge[baseID] = base
		state.mu.Unlock()

		response.Created(c, gin.H{"file": file})
	}
}

func UpdateKnowledgeFile() gin.HandlerFunc {
	return func(c *gin.Context) {
		baseID := c.Param("id")
		fileID := c.Param("fileId")
		var req updateKnowledgeFileReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid file body")
			return
		}
		state.mu.Lock()
		base, ok := state.knowledge[baseID]
		if !ok {
			state.mu.Unlock()
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		idx := -1
		for i := range base.Files {
			if base.Files[i].ID == fileID {
				idx = i
				break
			}
		}
		if idx < 0 {
			state.mu.Unlock()
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_FILE_NOT_FOUND", "knowledge file not found")
			return
		}
		if req.DisplayName != nil {
			base.Files[idx].DisplayName = *req.DisplayName
		}
		if req.Content != nil {
			base.Files[idx].Content = *req.Content
		}
		if req.Order != nil {
			base.Files[idx].Order = *req.Order
		}
		base.Files[idx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		base.UpdatedAt = base.Files[idx].UpdatedAt
		state.knowledge[baseID] = base
		file := base.Files[idx]
		state.mu.Unlock()

		response.OK(c, gin.H{"file": file})
	}
}

func DeleteKnowledgeFile() gin.HandlerFunc {
	return func(c *gin.Context) {
		baseID := c.Param("id")
		fileID := c.Param("fileId")
		state.mu.Lock()
		base, ok := state.knowledge[baseID]
		if !ok {
			state.mu.Unlock()
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		next := make([]webKnowledgeFile, 0, len(base.Files))
		for _, file := range base.Files {
			if file.ID != fileID {
				next = append(next, file)
			}
		}
		base.Files = next
		base.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state.knowledge[baseID] = base
		state.mu.Unlock()
		response.OK(c, gin.H{"deleted": true})
	}
}

func ReorderKnowledgeFiles() gin.HandlerFunc {
	return func(c *gin.Context) {
		baseID := c.Param("id")
		var req reorderKnowledgeFileReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid reorder body")
			return
		}
		state.mu.Lock()
		base, ok := state.knowledge[baseID]
		if !ok {
			state.mu.Unlock()
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		orderMap := map[string]int{}
		for idx, id := range req.FileIDs {
			orderMap[id] = idx + 1
		}
		for i := range base.Files {
			if val, ok := orderMap[base.Files[i].ID]; ok {
				base.Files[i].Order = val
				base.Files[i].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			}
		}
		base.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state.knowledge[baseID] = base
		state.mu.Unlock()
		response.OK(c, gin.H{"updated": true})
	}
}

func GetKnowledgeFileContent() gin.HandlerFunc {
	return func(c *gin.Context) {
		baseID := c.Param("id")
		fileID := c.Param("fileId")
		state.mu.RLock()
		base, ok := state.knowledge[baseID]
		if !ok {
			state.mu.RUnlock()
			response.Error(c, http.StatusNotFound, "KNOWLEDGE_BASE_NOT_FOUND", "knowledge base not found")
			return
		}
		content := ""
		for _, file := range base.Files {
			if file.ID == fileID {
				content = file.Content
				break
			}
		}
		state.mu.RUnlock()
		response.OK(c, gin.H{"content": content})
	}
}
