package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

func StreamGradeAssessment(agentServiceURL, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		streamID := "assessment-grade-" + strconvNow()
		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "STREAM_NOT_SUPPORTED", "message": "streaming is not supported"}})
			return
		}
		var req assessmentIDReq
		if err := c.ShouldBindJSON(&req); err != nil || req.AssessmentID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "INVALID_BODY", "message": "assessmentId is required"}})
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
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
			payload["assessmentId"] = req.AssessmentID
			data, _ := json.Marshal(payload)
			_, _ = c.Writer.Write([]byte("data: " + string(data) + "\n\n"))
			flusher.Flush()
		}

		sendEvent(gin.H{"type": "assessment.grade.start", "startedAt": time.Now().UTC().Format(time.RFC3339)})
		sendEvent(gin.H{"type": "assessment.grade.stage", "stage": "loading", "message": "正在读取作答与题目信息..."})
		sendEvent(gin.H{"type": "assessment.grade.stage", "stage": "grading", "message": "正在批改答案并生成反馈..."})

		result, err := gradeAssessment(c, db, agentServiceURL, internalToken, req.AssessmentID)
		if err != nil {
			sendEvent(gin.H{"type": "assessment.grade.error", "message": "批改失败，请稍后重试"})
			return
		}

		sendEvent(gin.H{"type": "assessment.grade.stage", "stage": "saving", "message": "正在保存批改结果..."})
		sendEvent(gin.H{"type": "assessment.grade.done", "result": result})
	}
}
