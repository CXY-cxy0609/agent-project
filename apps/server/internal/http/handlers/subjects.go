package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
	"tutor-server/internal/service"
)

func ListSubjects(subjectService *service.SubjectService) gin.HandlerFunc {
	return func(c *gin.Context) {
		subjects, err := subjectService.List(c.Request.Context())
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "SUBJECTS_LIST_FAILED", "failed to list subjects")
			return
		}
		response.OK(c, gin.H{"list": subjects, "total": len(subjects)})
	}
}
