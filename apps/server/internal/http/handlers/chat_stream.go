package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

func ChatStream(agentServiceURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		streamID := "stream-" + strconvNow()
		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "STREAM_NOT_SUPPORTED", "message": "streaming is not supported"}})
			return
		}

		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "INVALID_BODY", "message": "invalid request body"}})
			return
		}
		defer c.Request.Body.Close()
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}

		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache, no-transform")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("X-Accel-Buffering", "no")

		var eventMu sync.Mutex
		sendEvent := func(payload map[string]any) {
			eventMu.Lock()
			defer eventMu.Unlock()
			data, _ := json.Marshal(payload)
			_, _ = c.Writer.Write([]byte("data: " + string(data) + "\n\n"))
			flusher.Flush()
		}

		sendEvent(map[string]any{
			"type":      "start",
			"streamId":  streamID,
			"sequence":  0,
			"startedAt": time.Now().UTC().Format(time.RFC3339),
		})
		var body chatStreamReq
		if err := json.Unmarshal(bodyBytes, &body); err != nil {
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": 1, "message": "invalid stream body"})
			return
		}
		turn, err := beginConversationTurn(c, db, body)
		if err != nil {
			log.Printf("beginConversationTurn failed request_id=%s conversation_id=%s subject_id=%d user_id=%s err=%v", c.GetString("request_id"), body.ConversationID, body.SubjectID, body.UserID, err)
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": 1, "message": "failed to initialize conversation turn"})
			return
		}
		eventSeq := 1
		nextSeq := func() int {
			eventMu.Lock()
			defer eventMu.Unlock()
			eventSeq++
			return eventSeq
		}
		sendEvent(map[string]any{
			"type":         "conversation.meta",
			"streamId":     streamID,
			"sequence":     nextSeq(),
			"conversation": turn.Conversation,
		})
		sendEvent(map[string]any{
			"type":             "message.created",
			"streamId":         streamID,
			"sequence":         nextSeq(),
			"userMessage":      turn.UserMessage,
			"assistantMessage": turn.AssistantMsg,
		})

		heartbeatStop := make(chan struct{})
		var heartbeatOnce sync.Once
		stopHeartbeat := func() {
			heartbeatOnce.Do(func() { close(heartbeatStop) })
		}
		go func() {
			ticker := time.NewTicker(15 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					sendEvent(map[string]any{
						"type":      "heartbeat",
						"streamId":  streamID,
						"sequence":  nextSeq(),
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					})
				case <-heartbeatStop:
					return
				}
			}
		}()

		upstreamBody, err := buildAgentStreamBody(bodyBytes, turn)
		if err != nil {
			stopHeartbeat()
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": "failed to build upstream request"})
			return
		}
		req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, strings.TrimRight(agentServiceURL, "/")+"/chat/stream", bytes.NewReader(upstreamBody))
		if err != nil {
			stopHeartbeat()
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": "failed to create upstream request"})
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			req.Header.Set("Authorization", authHeader)
		}

		client := &http.Client{Timeout: 20 * time.Minute}
		resp, err := client.Do(req)
		if err != nil {
			stopHeartbeat()
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": err.Error()})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			stopHeartbeat()
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": "upstream stream failed", "status": resp.StatusCode})
			return
		}

		reader := bufio.NewReader(resp.Body)
		accumulated := strings.Builder{}
		finalized := false
		var finalTitle string
		finalMetadata := map[string]any{}
		for {
			line, readErr := reader.ReadString('\n')
			if readErr != nil {
				if readErr == io.EOF {
					break
				}
				stopHeartbeat()
				sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": readErr.Error()})
				return
			}
			line = strings.TrimSpace(line)
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			raw := strings.TrimPrefix(line, "data: ")
			if raw == "[DONE]" {
				continue
			}
			var upstream map[string]any
			if err := json.Unmarshal([]byte(raw), &upstream); err != nil {
				continue
			}
			eventType, _ := upstream["type"].(string)
			switch eventType {
			case "reasoning", "intent":
				if title, _ := upstream["title"].(string); strings.TrimSpace(title) != "" {
					finalTitle = title
				}
				if reasoning, _ := upstream["reasoning"].(string); strings.TrimSpace(reasoning) != "" {
					finalMetadata["reasoning"] = reasoning
					finalMetadata["thoughtChain"] = []map[string]any{{
						"title":   "意图识别",
						"content": reasoning,
						"status":  "done",
					}}
				}
				semanticSummary := firstNonEmptyStringValue(upstream["semanticSummary"], upstream["semantic_summary"])
				if strings.TrimSpace(semanticSummary) != "" {
					finalMetadata["semanticSummary"] = semanticSummary
				}
				sendEvent(map[string]any{
					"type":               "intent",
					"streamId":           streamID,
					"sequence":           nextSeq(),
					"intent":             upstream["intent"],
					"reasoning":          upstream["reasoning"],
					"semanticSummary":    semanticSummary,
					"title":              upstream["title"],
					"assistantMessageId": turn.AssistantMsg.ID,
				})
			case "delta":
				delta, _ := upstream["delta"].(string)
				if delta == "" {
					continue
				}
				accumulated.WriteString(delta)
				sendEvent(map[string]any{
					"type":               "delta",
					"streamId":           streamID,
					"sequence":           nextSeq(),
					"assistantMessageId": turn.AssistantMsg.ID,
					"delta":              delta,
				})
			case "reply":
				content, _ := upstream["content"].(string)
				if accumulated.Len() == 0 && content != "" {
					accumulated.WriteString(content)
					sendEvent(map[string]any{
						"type":               "delta",
						"streamId":           streamID,
						"sequence":           nextSeq(),
						"assistantMessageId": turn.AssistantMsg.ID,
						"delta":              content,
					})
				}
				finalTitle = firstNonEmptyString(finalTitle, upstream["title"])
				mergeStreamMetadata(finalMetadata, upstream)
				finalTurn, err := finalizeConversationTurn(c, db, turn, accumulated.String(), finalMetadata, finalTitle)
				if err != nil {
					stopHeartbeat()
					sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": "failed to finalize conversation turn"})
					return
				}
				turn = finalTurn
				finalized = true
				sendEvent(map[string]any{
					"type":             "message.finalized",
					"streamId":         streamID,
					"sequence":         nextSeq(),
					"assistantMessage": turn.AssistantMsg,
					"metadata":         finalMetadata,
				})
				sendEvent(map[string]any{
					"type":         "conversation.meta",
					"streamId":     streamID,
					"sequence":     nextSeq(),
					"conversation": turn.Conversation,
				})
			case "error":
				stopHeartbeat()
				sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": upstream["message"]})
				return
			case "done":
				if !finalized {
					finalTurn, err := finalizeConversationTurn(c, db, turn, accumulated.String(), finalMetadata, finalTitle)
					if err != nil {
						stopHeartbeat()
						sendEvent(map[string]any{"type": "error", "streamId": streamID, "sequence": nextSeq(), "message": "failed to finalize conversation turn"})
						return
					}
					turn = finalTurn
					sendEvent(map[string]any{
						"type":             "message.finalized",
						"streamId":         streamID,
						"sequence":         nextSeq(),
						"assistantMessage": turn.AssistantMsg,
						"metadata":         finalMetadata,
					})
				}
				stopHeartbeat()
				sendEvent(map[string]any{
					"type":           "done",
					"streamId":       streamID,
					"sequence":       nextSeq(),
					"conversationId": turn.Conversation.ID,
					"finishedAt":     time.Now().UTC().Format(time.RFC3339),
				})
				return
			}
		}

		stopHeartbeat()
		sendEvent(map[string]any{
			"type":           "done",
			"streamId":       streamID,
			"sequence":       nextSeq(),
			"conversationId": turn.Conversation.ID,
			"finishedAt":     time.Now().UTC().Format(time.RFC3339),
		})
	}
}

func strconvNow() string {
	return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
}

func buildAgentStreamBody(bodyBytes []byte, turn conversationTurn) ([]byte, error) {
	var payload map[string]any
	if err := json.Unmarshal(bodyBytes, &payload); err != nil {
		return nil, err
	}
	payload["conversationId"] = turn.Conversation.ID
	payload["subjectId"] = turn.SubjectID
	payload["userId"] = turn.UserID
	payload["messageCount"] = 0
	if !turn.WasFirstTurn {
		payload["messageCount"] = turn.Conversation.MessageCount - 2
	}
	return json.Marshal(payload)
}

func mergeStreamMetadata(target map[string]any, upstream map[string]any) {
	for _, key := range []string{"videoUrl", "videoRunId", "artifactBundleUrl", "artifactManifestUrl"} {
		if value, ok := upstream[key]; ok && value != nil {
			target[key] = value
		}
	}
}

func firstNonEmptyString(current string, value any) string {
	if strings.TrimSpace(current) != "" {
		return current
	}
	next, _ := value.(string)
	return strings.TrimSpace(next)
}

func firstNonEmptyStringValue(values ...any) string {
	for _, value := range values {
		if str, _ := value.(string); strings.TrimSpace(str) != "" {
			return strings.TrimSpace(str)
		}
	}
	return ""
}
