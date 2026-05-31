package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

type createSubjectReq struct {
	Name        string `json:"name"`
	Code        int    `json:"code"`
	ParentID    *int   `json:"parentId"`
	Description string `json:"description"`
}

type updateSubjectReq struct {
	Name        *string `json:"name"`
	Code        *int    `json:"code"`
	ParentID    *int    `json:"parentId"`
	Description *string `json:"description"`
}

type updateOutlineReq struct {
	Outline subjectOutline `json:"outline"`
}

func ListMySubjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		state.mu.RLock()
		subjects := listSubjectsSorted(state.subjects)
		state.mu.RUnlock()
		result := make([]webUserSubject, 0, len(subjects))
		for _, item := range subjects {
			result = append(result, webUserSubject{webSubject: item, IsOwner: true})
		}
		response.OK(c, gin.H{"list": result, "total": len(result)})
	}
}

func SearchSubjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		keyword := c.Query("keyword")
		state.mu.RLock()
		subjects := listSubjectsSorted(state.subjects)
		state.mu.RUnlock()
		result := make([]webSubject, 0, len(subjects))
		for _, item := range subjects {
			if filterIncludes(item.Name, keyword) || filterIncludes(strconv.Itoa(item.Code), keyword) {
				result = append(result, item)
			}
		}
		response.OK(c, gin.H{"list": result, "total": len(result)})
	}
}

func CreateSubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createSubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid subject body")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		state.mu.Lock()
		id := state.nextSubjectID
		state.nextSubjectID++
		level := 1
		if req.ParentID != nil {
			level = 2
		}
		subject := webSubject{
			ID: id, Name: req.Name, Code: req.Code, ParentID: req.ParentID, Level: level,
			Description: req.Description, Outline: subjectOutline{Modules: []outlineModule{}},
			CreatedAt: now, UpdatedAt: now,
		}
		state.subjects[id] = subject
		state.mu.Unlock()
		response.OK(c, gin.H{
			"id":          subject.ID,
			"name":        subject.Name,
			"code":        subject.Code,
			"parentId":    subject.ParentID,
			"level":       subject.Level,
			"description": subject.Description,
			"outline":     subject.Outline,
			"createdAt":   subject.CreatedAt,
			"updatedAt":   subject.UpdatedAt,
		})
	}
}

func UpdateSubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		var req updateSubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid subject body")
			return
		}
		state.mu.Lock()
		subject, ok := state.subjects[id]
		if !ok {
			state.mu.Unlock()
			response.Error(c, http.StatusNotFound, "SUBJECT_NOT_FOUND", "subject not found")
			return
		}
		if req.Name != nil {
			subject.Name = *req.Name
		}
		if req.Code != nil {
			subject.Code = *req.Code
		}
		if req.ParentID != nil {
			subject.ParentID = req.ParentID
			subject.Level = 2
		}
		if req.Description != nil {
			subject.Description = *req.Description
		}
		subject.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state.subjects[id] = subject
		state.mu.Unlock()
		response.OK(c, gin.H{
			"id":          subject.ID,
			"name":        subject.Name,
			"code":        subject.Code,
			"parentId":    subject.ParentID,
			"level":       subject.Level,
			"description": subject.Description,
			"outline":     subject.Outline,
			"createdAt":   subject.CreatedAt,
			"updatedAt":   subject.UpdatedAt,
		})
	}
}

func DeleteSubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		state.mu.Lock()
		delete(state.subjects, id)
		state.mu.Unlock()
		response.OK(c, gin.H{"deleted": true})
	}
}

func AddMySubject() gin.HandlerFunc {
	return func(c *gin.Context) { response.OK(c, gin.H{"added": true}) }
}

func RemoveMySubject() gin.HandlerFunc {
	return func(c *gin.Context) { response.OK(c, gin.H{"removed": true}) }
}

func GetSubjectOutline() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		state.mu.RLock()
		subject, ok := state.subjects[id]
		state.mu.RUnlock()
		if !ok {
			response.Error(c, http.StatusNotFound, "SUBJECT_NOT_FOUND", "subject not found")
			return
		}
		response.OK(c, gin.H{"modules": subject.Outline.Modules})
	}
}

func UpdateSubjectOutline() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		var req updateOutlineReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid outline body")
			return
		}
		state.mu.Lock()
		subject, ok := state.subjects[id]
		if !ok {
			state.mu.Unlock()
			response.Error(c, http.StatusNotFound, "SUBJECT_NOT_FOUND", "subject not found")
			return
		}
		subject.Outline = req.Outline
		subject.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state.subjects[id] = subject
		state.mu.Unlock()
		response.OK(c, gin.H{"updated": true})
	}
}

func AdminListSubjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		state.mu.RLock()
		subjects := listSubjectsSorted(state.subjects)
		state.mu.RUnlock()
		response.OK(c, gin.H{"list": subjects, "total": len(subjects)})
	}
}

func AdminDeleteSubject() gin.HandlerFunc {
	return DeleteSubject()
}
