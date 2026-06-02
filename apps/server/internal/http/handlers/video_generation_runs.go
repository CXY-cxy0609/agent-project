package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
	"tutor-server/internal/repository"
	"tutor-server/internal/service"
)

func UpsertVideoGenerationRun(videoRunService *service.VideoGenerationRunService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req service.UpsertVideoGenerationRunInput
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid video run body")
			return
		}
		if req.RunID == "" || req.WorkflowID == "" || req.TraceID == "" || req.Status == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_VIDEO_RUN", "run_id/workflow_id/trace_id/status are required")
			return
		}
		if err := videoRunService.Upsert(c.Request.Context(), req); err != nil {
			response.Error(c, http.StatusInternalServerError, "VIDEO_RUN_UPSERT_FAILED", "failed to persist video run")
			return
		}
		response.OK(c, gin.H{"saved": true})
	}
}

func GetVideoGenerationRun(videoRunService *service.VideoGenerationRunService) gin.HandlerFunc {
	return func(c *gin.Context) {
		runID := c.Param("runId")
		if runID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_RUN_ID", "runId is required")
			return
		}
		run, err := videoRunService.GetByRunID(c.Request.Context(), runID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				response.Error(c, http.StatusNotFound, "VIDEO_RUN_NOT_FOUND", "video run not found")
				return
			}
			response.Error(c, http.StatusInternalServerError, "VIDEO_RUN_QUERY_FAILED", "failed to query video run")
			return
		}
		response.OK(c, gin.H{"run": run})
	}
}
