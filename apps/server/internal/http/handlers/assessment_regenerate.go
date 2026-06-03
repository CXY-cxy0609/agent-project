package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

type storedAssessmentGeneration struct {
	UserID           string
	SubjectID        *int
	Source           string
	Status           string
	GenerationConfig assessmentGenerationConfigReq
	KnowledgePoints  []assessmentKnowledgePointReq
}

func StreamRegenerateAssessment(agentServiceURL, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		streamID := "assessment-regenerate-" + strconvNow()
		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "STREAM_NOT_SUPPORTED", "message": "streaming is not supported"}})
			return
		}
		var req assessmentIDReq
		if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.AssessmentID) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "INVALID_BODY", "message": "assessmentId is required"}})
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
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
			data, _ := json.Marshal(payload)
			_, _ = c.Writer.Write([]byte("data: " + string(data) + "\n\n"))
			flusher.Flush()
		}

		assessmentID := strings.TrimSpace(req.AssessmentID)
		stored, err := queryStoredAssessmentGeneration(c, db, assessmentID, userID)
		if err != nil {
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "测试记录不存在或无权访问"})
			return
		}
		if stored.Status != "failed" {
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "只有生成失败的测试可以重新生成"})
			return
		}

		result, err := db.ExecContext(
			c,
			`UPDATE assessment_sessions SET status = 'generating' WHERE assessment_id = ? AND user_id = ? AND status = 'failed'`,
			assessmentID,
			userID,
		)
		if err != nil {
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "重新生成启动失败"})
			return
		}
		changed, _ := result.RowsAffected()
		if changed != 1 {
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "测试状态已变化，请刷新后重试"})
			return
		}
		if _, err := db.ExecContext(c, `DELETE FROM assessment_questions WHERE assessment_id = ?`, assessmentID); err != nil {
			_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "清理旧题目失败，请重试"})
			return
		}

		generationReq := generateAssessmentReq{
			SubjectID:        stored.SubjectID,
			Source:           stored.Source,
			KnowledgePoints:  stored.KnowledgePoints,
			GenerationConfig: stored.GenerationConfig,
		}
		totalCount := totalConfiguredQuestions(generationReq)
		startItem, _ := queryAssessmentDetail(c, db, assessmentID)
		sendEvent(gin.H{"type": "assessment.start", "assessmentId": assessmentID, "totalCount": totalCount, "assessment": startItem})
		sendEvent(gin.H{"type": "assessment.stage", "assessmentId": assessmentID, "message": "正在重新生成测试题...", "generatedCount": 0, "totalCount": totalCount})

		questions, err := requestAssessmentGeneration(c, agentServiceURL, internalToken, userID, assessmentID, generationReq)
		if err != nil {
			_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "题目重新生成失败，请稍后重试"})
			return
		}
		for idx, question := range questions {
			question["assessmentId"] = assessmentID
			if err := validateAssessmentQuestionPayload(question); err != nil {
				_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
				sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": err.Error()})
				return
			}
			if err := insertAssessmentQuestion(c, db, question); err != nil {
				_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
				sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "failed to save assessment question"})
				return
			}
			sendEvent(gin.H{"type": "assessment.question.created", "assessmentId": assessmentID, "question": question, "generatedCount": idx + 1, "totalCount": totalCount})
		}
		_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'answering' WHERE assessment_id = ?`, assessmentID)
		_ = emitAssessmentEvent(c, db, userID, generationReq.SubjectID, defaultString(generationReq.Source, "manual"), "assessment_generated", generationReq.KnowledgePoints)
		detail, _ := queryAssessmentDetail(c, db, assessmentID)
		sendEvent(gin.H{"type": "assessment.saved", "assessmentId": assessmentID, "assessment": detail})
		sendEvent(gin.H{"type": "assessment.done", "assessmentId": assessmentID})
	}
}

func queryStoredAssessmentGeneration(c *gin.Context, db *sql.DB, assessmentID string, userID string) (storedAssessmentGeneration, error) {
	var stored storedAssessmentGeneration
	var subjectID sql.NullInt64
	var configRaw, pointsRaw string
	err := db.QueryRowContext(
		c,
		`SELECT user_id, subject_id, source, status, generation_config_json, knowledge_points_json
		 FROM assessment_sessions
		 WHERE assessment_id = ? AND user_id = ?`,
		assessmentID,
		userID,
	).Scan(&stored.UserID, &subjectID, &stored.Source, &stored.Status, &configRaw, &pointsRaw)
	if err != nil {
		return stored, err
	}
	if subjectID.Valid {
		value := int(subjectID.Int64)
		stored.SubjectID = &value
	}
	if err := json.Unmarshal([]byte(configRaw), &stored.GenerationConfig); err != nil {
		return stored, err
	}
	if err := json.Unmarshal([]byte(pointsRaw), &stored.KnowledgePoints); err != nil {
		return stored, err
	}
	return stored, validateGenerationConfig(generateAssessmentReq{
		SubjectID:        stored.SubjectID,
		Source:           stored.Source,
		KnowledgePoints:  stored.KnowledgePoints,
		GenerationConfig: stored.GenerationConfig,
	})
}
