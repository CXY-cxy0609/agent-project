package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
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

		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache, no-transform")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("X-Accel-Buffering", "no")

		sendEvent := func(payload map[string]any) {
			data, _ := json.Marshal(payload)
			_, _ = c.Writer.Write([]byte("data: " + string(data) + "\n\n"))
			flusher.Flush()
		}

		sendEvent(map[string]any{
			"type":      "start",
			"streamId":  streamID,
			"startedAt": time.Now().UTC().Format(time.RFC3339),
		})

		heartbeatStop := make(chan struct{})
		go func() {
			ticker := time.NewTicker(15 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ticker.C:
					sendEvent(map[string]any{
						"type":      "heartbeat",
						"streamId":  streamID,
						"timestamp": time.Now().UTC().Format(time.RFC3339),
					})
				case <-heartbeatStop:
					return
				}
			}
		}()

		req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, strings.TrimRight(agentServiceURL, "/")+"/chat/stream", bytes.NewReader(bodyBytes))
		if err != nil {
			close(heartbeatStop)
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "message": "failed to create upstream request"})
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if authHeader := c.GetHeader("Authorization"); authHeader != "" {
			req.Header.Set("Authorization", authHeader)
		}

		client := &http.Client{Timeout: 10 * time.Minute}
		resp, err := client.Do(req)
		if err != nil {
			close(heartbeatStop)
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "message": err.Error()})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			close(heartbeatStop)
			sendEvent(map[string]any{"type": "error", "streamId": streamID, "message": "upstream stream failed", "status": resp.StatusCode})
			return
		}

		reader := bufio.NewReader(resp.Body)
		seq := 0
		hasDelta := false
		for {
			line, readErr := reader.ReadString('\n')
			if readErr != nil {
				if readErr == io.EOF {
					break
				}
				close(heartbeatStop)
				sendEvent(map[string]any{"type": "error", "streamId": streamID, "message": readErr.Error()})
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
			case "delta":
				delta, _ := upstream["delta"].(string)
				if delta == "" {
					continue
				}
				hasDelta = true
				seq++
				sendEvent(map[string]any{
					"type":                "delta",
					"streamId":            streamID,
					"sequence":            seq,
					"delta":               delta,
					"content":             delta,
					"conversationId":      upstream["conversationId"],
					"subjectId":           upstream["subjectId"],
					"intent":              upstream["intent"],
					"videoUrl":            upstream["videoUrl"],
					"videoRunId":          upstream["videoRunId"],
					"artifactBundleUrl":   upstream["artifactBundleUrl"],
					"artifactManifestUrl": upstream["artifactManifestUrl"],
				})
			case "reply":
				content, _ := upstream["content"].(string)
				if hasDelta {
					seq++
					sendEvent(map[string]any{
						"type":           "delta",
						"streamId":       streamID,
						"sequence":       seq,
						"delta":          "",
						"content":        "",
						"conversationId": upstream["conversationId"],
						"subjectId":      upstream["subjectId"],
						"intent":         upstream["intent"],
					})
					continue
				}
				seq++
				sendEvent(map[string]any{
					"type":                "delta",
					"streamId":            streamID,
					"sequence":            seq,
					"delta":               content,
					"content":             content,
					"conversationId":      upstream["conversationId"],
					"subjectId":           upstream["subjectId"],
					"intent":              upstream["intent"],
					"videoUrl":            upstream["videoUrl"],
					"videoRunId":          upstream["videoRunId"],
					"artifactBundleUrl":   upstream["artifactBundleUrl"],
					"artifactManifestUrl": upstream["artifactManifestUrl"],
				})
			case "error":
				close(heartbeatStop)
				sendEvent(map[string]any{"type": "error", "streamId": streamID, "message": upstream["message"]})
				return
			case "done":
				close(heartbeatStop)
				sendEvent(map[string]any{
					"type":       "done",
					"streamId":   streamID,
					"finishedAt": time.Now().UTC().Format(time.RFC3339),
				})
				return
			}
		}

		close(heartbeatStop)
		sendEvent(map[string]any{
			"type":       "done",
			"streamId":   streamID,
			"finishedAt": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

func strconvNow() string {
	return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
}
