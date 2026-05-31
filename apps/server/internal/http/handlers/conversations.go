package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
	"tutor-server/internal/service"
)

type createConversationReq struct {
	Title     string `json:"title"`
	SubjectID string `json:"subject_id"`
	UserID    string `json:"user_id"`
}

func ListConversations(conversationService *service.ConversationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		list, err := conversationService.List(c.Request.Context())
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "CONVERSATIONS_LIST_FAILED", "failed to list conversations")
			return
		}
		response.OK(c, gin.H{"list": list, "total": len(list)})
	}
}

func CreateConversation(conversationService *service.ConversationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createConversationReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid conversation body")
			return
		}
		if req.Title == "" || req.SubjectID == "" || req.UserID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_CONVERSATION_FIELDS", "title, subject_id and user_id are required")
			return
		}

		conversation, err := conversationService.Create(c.Request.Context(), req.Title, req.SubjectID, req.UserID)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "CONVERSATION_CREATE_FAILED", "failed to create conversation")
			return
		}
		response.Created(c, gin.H{
			"conversation": conversation,
		})
	}
}
