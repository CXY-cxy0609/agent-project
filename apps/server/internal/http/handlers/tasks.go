package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/middleware"
	"tutor-server/internal/http/response"
	"tutor-server/internal/repository"
	"tutor-server/internal/service"
)

type createTaskReq struct {
	Type    string                 `json:"type"`
	Payload map[string]interface{} `json:"payload"`
}

func CreateTask(taskService *service.TaskService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createTaskReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid task body")
			return
		}
		if req.Type == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_TASK_TYPE", "task type is required")
			return
		}

		task, err := taskService.Create(c.Request.Context(), req.Type, middleware.GetRequestID(c))
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "TASK_CREATE_FAILED", "failed to enqueue task")
			return
		}

		response.Created(c, gin.H{
			"task": task,
			"note": "task queued successfully, worker integration pending",
		})
	}
}

func GetTask(taskService *service.TaskService) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID := c.Param("id")
		if taskID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_TASK_ID", "task id is required")
			return
		}

		task, err := taskService.GetByID(c.Request.Context(), taskID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				response.Error(c, http.StatusNotFound, "TASK_NOT_FOUND", "task not found")
				return
			}
			response.Error(c, http.StatusInternalServerError, "TASK_QUERY_FAILED", "failed to query task")
			return
		}

		response.OK(c, gin.H{"task": task})
	}
}
