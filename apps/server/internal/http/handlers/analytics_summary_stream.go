package handlers

import (
	"bufio"
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

func StreamAnalyticsSummary(agentServiceURL, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		streamID := "analytics-summary-stream-" + strconvNow()
		summaryID := "asum-" + strconvNow()
		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "STREAM_NOT_SUPPORTED", "message": "streaming is not supported"}})
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}

		var req analyticsSummaryReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "INVALID_BODY", "message": "invalid analytics summary body"}})
			return
		}
		userID, _ := latestUserID(c, db)
		if userID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "USER_NOT_FOUND", "message": "no user available"}})
			return
		}

		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache, no-transform")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("X-Accel-Buffering", "no")

		seq := 0
		var eventMu sync.Mutex
		sendEvent := func(payload gin.H) {
			eventMu.Lock()
			defer eventMu.Unlock()
			seq++
			payload["streamId"] = streamID
			payload["sequence"] = seq
			if _, exists := payload["summaryId"]; !exists {
				payload["summaryId"] = summaryID
			}
			data, _ := json.Marshal(payload)
			_, _ = c.Writer.Write([]byte("data: " + string(data) + "\n\n"))
			flusher.Flush()
		}

		sendEvent(gin.H{"type": "summary.start", "startedAt": time.Now().UTC().Format(time.RFC3339)})
		sendEvent(gin.H{"type": "summary.stage", "stage": "collecting", "message": "正在读取学习数据..."})

		payload, err := buildAnalyticsSummaryPayload(c, db, userID, req)
		if err != nil {
			sendEvent(gin.H{"type": "summary.error", "message": "failed to build analytics snapshot"})
			return
		}
		sendEvent(gin.H{"type": "summary.stage", "stage": "analyzing", "message": "正在识别薄弱知识点..."})

		body, _ := json.Marshal(payload)
		upstreamReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, strings.TrimRight(agentServiceURL, "/")+"/learning-summary/stream", bytes.NewReader(body))
		if err != nil {
			sendEvent(gin.H{"type": "summary.error", "message": "failed to create upstream request"})
			return
		}
		upstreamReq.Header.Set("Content-Type", "application/json")
		if internalToken != "" {
			upstreamReq.Header.Set("x-internal-token", internalToken)
		}

		resp, err := http.DefaultClient.Do(upstreamReq)
		if err != nil {
			sendEvent(gin.H{"type": "summary.error", "message": err.Error()})
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			sendEvent(gin.H{"type": "summary.error", "message": "upstream summary stream failed", "status": resp.StatusCode})
			return
		}

		finalSummary := gin.H{}
		reader := bufio.NewReader(resp.Body)
		for {
			line, readErr := reader.ReadString('\n')
			if readErr != nil {
				if readErr == io.EOF {
					break
				}
				sendEvent(gin.H{"type": "summary.error", "message": readErr.Error()})
				return
			}
			line = strings.TrimSpace(line)
			if !strings.HasPrefix(line, "data:") {
				continue
			}
			raw := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if raw == "" || raw == "[DONE]" {
				continue
			}
			var upstream gin.H
			if err := json.Unmarshal([]byte(raw), &upstream); err != nil {
				continue
			}
			switch upstream["type"] {
			case "stage":
				sendEvent(gin.H{"type": "summary.stage", "stage": upstream["stage"], "message": upstream["message"]})
			case "delta":
				sendEvent(gin.H{"type": "summary.delta", "delta": upstream["delta"]})
			case "final":
				if output, ok := upstream["output"].(map[string]any); ok {
					finalSummary = output
				}
			case "error":
				sendEvent(gin.H{"type": "summary.error", "message": upstream["message"]})
				return
			}
		}

		if summaryText, _ := finalSummary["summary"].(string); strings.TrimSpace(summaryText) != "" {
			sendEvent(gin.H{"type": "summary.stage", "stage": "saving", "message": "正在保存最新总结..."})
			if err := saveAnalyticsSummary(c, db, userID, nullableRequestSubjectID(req.SubjectID), summaryText); err != nil {
				sendEvent(gin.H{"type": "summary.error", "message": "failed to save analytics summary"})
				return
			}
			finalSummary["generatedAt"] = time.Now().UTC().Format(time.RFC3339)
			sendEvent(gin.H{"type": "summary.saved", "summary": finalSummary})
		}
		sendEvent(gin.H{"type": "summary.done"})
	}
}

func buildAnalyticsSummaryPayload(c *gin.Context, db *sql.DB, userID string, req analyticsSummaryReq) (gin.H, error) {
	overviewReq := analyticsOverviewReq{Scope: req.Scope, SubjectID: req.SubjectID}
	if overviewReq.Scope == "" {
		overviewReq.Scope = "overall"
	}
	weakPoints, wordCloud, err := queryAnalyticsWeakPoints(c, db, userID, overviewReq)
	if err != nil {
		return nil, err
	}
	distribution, err := querySubjectDistribution(c, db, userID)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"userId":    userID,
		"scope":     overviewReq.Scope,
		"subjectId": req.SubjectID,
		"analytics": gin.H{
			"cards":               buildAnalyticsCards(weakPoints, distribution),
			"weakPoints":          weakPoints,
			"wordCloud":           wordCloud,
			"subjectDistribution": distribution,
		},
		"recentEvents":      []gin.H{},
		"recentAssessments": []gin.H{},
		"traceId":           c.GetString("request_id"),
	}, nil
}

func nullableRequestSubjectID(subjectID *int) any {
	if subjectID == nil {
		return nil
	}
	return *subjectID
}
