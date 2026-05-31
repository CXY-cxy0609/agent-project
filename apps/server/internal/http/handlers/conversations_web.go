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

type createConversationWebReq struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	SubjectID int    `json:"subjectId"`
	UserID    string `json:"userId"`
}

type createMessageReq struct {
	ID      string `json:"id"`
	Role    string `json:"role"`
	Content string `json:"content"`
	Status  string `json:"status"`
}

func ListConversationsWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		subjectID, _ := strconv.Atoi(c.Query("subjectId"))
		titleKeyword := c.Query("title")
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", c.DefaultQuery("page_size", "20")))
		if page <= 0 {
			page = 1
		}
		if pageSize <= 0 {
			pageSize = 20
		}

		state.mu.RLock()
		list := make([]webConversation, 0, len(state.conversations))
		for _, item := range state.conversations {
			if subjectID > 0 && item.SubjectID != subjectID {
				continue
			}
			if !filterIncludes(item.Title, titleKeyword) {
				continue
			}
			list = append(list, item)
		}
		state.mu.RUnlock()

		sort.Slice(list, func(i, j int) bool {
			return list[i].UpdatedAt > list[j].UpdatedAt
		})
		total := len(list)
		start := (page - 1) * pageSize
		if start > total {
			start = total
		}
		end := start + pageSize
		if end > total {
			end = total
		}
		response.OK(c, gin.H{
			"list":     list[start:end],
			"total":    total,
			"page":     page,
			"pageSize": pageSize,
		})
	}
}

func GetConversationWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		state.mu.RLock()
		conversation, ok := state.conversations[id]
		state.mu.RUnlock()
		if !ok {
			response.Error(c, http.StatusNotFound, "CONVERSATION_NOT_FOUND", "conversation not found")
			return
		}
		response.OK(c, gin.H{
			"id":           conversation.ID,
			"title":        conversation.Title,
			"subjectId":    conversation.SubjectID,
			"subjectName":  conversation.SubjectName,
			"userId":       conversation.UserID,
			"createdAt":    conversation.CreatedAt,
			"updatedAt":    conversation.UpdatedAt,
			"messageCount": conversation.MessageCount,
		})
	}
}

func CreateConversationWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createConversationWebReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid conversation body")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if strings.TrimSpace(req.ID) == "" {
			req.ID = "conv-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		}
		if req.UserID == "" {
			req.UserID = "mock-user-001"
		}
		conversation := webConversation{
			ID:           req.ID,
			Title:        req.Title,
			SubjectID:    req.SubjectID,
			SubjectName:  "未分配学科",
			UserID:       req.UserID,
			CreatedAt:    now,
			UpdatedAt:    now,
			MessageCount: 0,
		}
		state.mu.Lock()
		conversation.SubjectName = subjectNameByID(state.subjects, conversation.SubjectID)
		state.conversations[conversation.ID] = conversation
		if _, ok := state.messages[conversation.ID]; !ok {
			state.messages[conversation.ID] = []webMessage{}
		}
		state.mu.Unlock()
		response.Created(c, gin.H{"conversation": conversation})
	}
}

func DeleteConversationWeb() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		state.mu.Lock()
		delete(state.conversations, id)
		delete(state.messages, id)
		state.mu.Unlock()
		response.OK(c, gin.H{"deleted": true})
	}
}

func ListConversationMessages() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		state.mu.RLock()
		items := append([]webMessage{}, state.messages[id]...)
		state.mu.RUnlock()
		response.OK(c, gin.H{"list": items})
	}
}

func CreateConversationMessage() gin.HandlerFunc {
	return func(c *gin.Context) {
		conversationID := c.Param("id")
		var req createMessageReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid message body")
			return
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if req.ID == "" {
			req.ID = "msg-" + strconv.FormatInt(time.Now().UnixNano(), 10)
		}
		if req.Status == "" {
			req.Status = "done"
		}

		state.mu.Lock()
		conversation, ok := state.conversations[conversationID]
		if !ok {
			conversation = webConversation{
				ID:           conversationID,
				Title:        "新对话",
				SubjectID:    0,
				SubjectName:  "未分配学科",
				UserID:       "mock-user-001",
				CreatedAt:    now,
				UpdatedAt:    now,
				MessageCount: 0,
			}
		}
		msg := webMessage{
			ID:             req.ID,
			ConversationID: conversationID,
			Role:           req.Role,
			Content:        req.Content,
			Status:         req.Status,
			CreatedAt:      now,
		}
		state.messages[conversationID] = append(state.messages[conversationID], msg)
		conversation.MessageCount = len(state.messages[conversationID])
		conversation.UpdatedAt = now
		if req.Role == "user" && conversation.Title == "新对话" && strings.TrimSpace(req.Content) != "" {
			runes := []rune(strings.TrimSpace(req.Content))
			if len(runes) > 24 {
				conversation.Title = string(runes[:24])
			} else {
				conversation.Title = string(runes)
			}
		}
		state.conversations[conversationID] = conversation
		state.mu.Unlock()

		response.Created(c, gin.H{"message": msg})
	}
}
