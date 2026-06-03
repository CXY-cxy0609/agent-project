package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"tutor-server/internal/http/response"
)

type assessmentKnowledgePointReq struct {
	KnowledgeKey string `json:"knowledgeKey"`
	Label        string `json:"label"`
	SubjectID    *int   `json:"subjectId"`
}

type assessmentQuestionTypeReq struct {
	Type  string `json:"type"`
	Count int    `json:"count"`
}

type assessmentGenerationConfigReq struct {
	Mode                  string                      `json:"mode"`
	QuestionCount         int                         `json:"questionCount"`
	Difficulty            string                      `json:"difficulty"`
	QuestionTypes         []assessmentQuestionTypeReq `json:"questionTypes"`
	ShowExplanationPolicy string                      `json:"showExplanationPolicy"`
	TimeLimitSeconds      *int                        `json:"timeLimitSeconds"`
	KnowledgeBasePolicy   string                      `json:"knowledgeBasePolicy"`
	Style                 string                      `json:"style"`
}

type generateAssessmentReq struct {
	SubjectID        *int                          `json:"subjectId"`
	Source           string                        `json:"source"`
	KnowledgePoints  []assessmentKnowledgePointReq `json:"knowledgePoints"`
	GenerationConfig assessmentGenerationConfigReq `json:"generationConfig"`
}

type submitAssessmentReq struct {
	AssessmentID string `json:"assessmentId"`
	Answers      []struct {
		QuestionID  string          `json:"questionId"`
		Answer      any             `json:"answer"`
		Attachments json.RawMessage `json:"attachments"`
	} `json:"answers"`
}

type assessmentIDReq struct {
	AssessmentID string `json:"assessmentId"`
	ID           string `json:"id"`
}

type assessmentListReq struct {
	SubjectID *int   `json:"subjectId"`
	Scope     string `json:"scope"`
	Status    string `json:"status"`
	Page      int    `json:"page"`
	PageSize  int    `json:"pageSize"`
}

func GenerateAssessment(agentServiceURL, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req generateAssessmentReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid assessment generation body")
			return
		}
		if err := validateGenerationConfig(req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_ASSESSMENT_CONFIG", err.Error())
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, _ := latestUserID(c, db)
		if userID == "" {
			response.Error(c, http.StatusBadRequest, "USER_NOT_FOUND", "no user available")
			return
		}
		assessmentID := "as_" + uuid.NewString()
		configRaw, _ := json.Marshal(req.GenerationConfig)
		pointsRaw, _ := json.Marshal(req.KnowledgePoints)
		mode := defaultString(req.GenerationConfig.Mode, "quick_practice")
		source := defaultString(req.Source, "manual")

		_, err := db.ExecContext(
			c,
			`INSERT INTO assessment_sessions
			(assessment_id, user_id, subject_id, source, mode, status, generation_config_json,
			 knowledge_points_json, time_limit_seconds, created_at)
			 VALUES (?, ?, ?, ?, ?, 'generating', ?, ?, ?, NOW())`,
			assessmentID,
			userID,
			req.SubjectID,
			source,
			mode,
			string(configRaw),
			string(pointsRaw),
			req.GenerationConfig.TimeLimitSeconds,
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ASSESSMENT_CREATE_FAILED", "failed to create assessment")
			return
		}
		questions, err := requestAssessmentGeneration(c, agentServiceURL, internalToken, userID, assessmentID, req)
		if err != nil {
			_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
			response.Error(c, http.StatusInternalServerError, "ASSESSMENT_AGENT_GENERATE_FAILED", "failed to generate assessment with agent")
			return
		}
		for _, question := range questions {
			question["assessmentId"] = assessmentID
			if err := validateAssessmentQuestionPayload(question); err != nil {
				_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
				response.Error(c, http.StatusInternalServerError, "ASSESSMENT_QUESTION_INVALID", err.Error())
				return
			}
			if err := insertAssessmentQuestion(c, db, question); err != nil {
				_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
				response.Error(c, http.StatusInternalServerError, "ASSESSMENT_QUESTION_CREATE_FAILED", "failed to create assessment question")
				return
			}
		}
		_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'answering' WHERE assessment_id = ?`, assessmentID)
		_ = emitAssessmentEvent(c, db, userID, req.SubjectID, source, "assessment_generated", req.KnowledgePoints)
		response.Created(c, gin.H{"assessmentId": assessmentID, "questions": questions})
	}
}

func StreamGenerateAssessment(agentServiceURL, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		streamID := "assessment-stream-" + strconvNow()
		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": gin.H{"code": "STREAM_NOT_SUPPORTED", "message": "streaming is not supported"}})
			return
		}
		var req generateAssessmentReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "INVALID_BODY", "message": "invalid assessment generation body"}})
			return
		}
		if err := validateGenerationConfig(req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "INVALID_ASSESSMENT_CONFIG", "message": err.Error()}})
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

		assessmentID := "as_" + uuid.NewString()
		totalCount := totalConfiguredQuestions(req)
		if err := createAssessmentSession(c, db, assessmentID, userID, req, "generating"); err != nil {
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "failed to create assessment"})
			return
		}
		startItem, _ := queryAssessmentDetail(c, db, assessmentID)
		sendEvent(gin.H{"type": "assessment.start", "assessmentId": assessmentID, "totalCount": totalCount, "assessment": startItem})
		sendEvent(gin.H{"type": "assessment.stage", "assessmentId": assessmentID, "message": "正在生成测试题...", "generatedCount": 0, "totalCount": totalCount})

		questions, err := requestAssessmentGeneration(c, agentServiceURL, internalToken, userID, assessmentID, req)
		if err != nil {
			_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'failed' WHERE assessment_id = ?`, assessmentID)
			sendEvent(gin.H{"type": "assessment.error", "assessmentId": assessmentID, "message": "题目生成失败，请重新生成"})
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
		_ = emitAssessmentEvent(c, db, userID, req.SubjectID, defaultString(req.Source, "manual"), "assessment_generated", req.KnowledgePoints)
		detail, _ := queryAssessmentDetail(c, db, assessmentID)
		sendEvent(gin.H{"type": "assessment.saved", "assessmentId": assessmentID, "assessment": detail})
		sendEvent(gin.H{"type": "assessment.done", "assessmentId": assessmentID})
	}
}

func SubmitAssessment() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req submitAssessmentReq
		if err := c.ShouldBindJSON(&req); err != nil || req.AssessmentID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "assessmentId and answers are required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		for _, answer := range req.Answers {
			raw, _ := json.Marshal(answer.Answer)
			attachments := string(answer.Attachments)
			if attachments == "" {
				attachments = "[]"
			}
			_, err := db.ExecContext(
				c,
				`INSERT INTO assessment_answers (assessment_id, question_id, user_answer_json, attachments_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?, NOW(), NOW())
				 ON DUPLICATE KEY UPDATE user_answer_json = VALUES(user_answer_json), attachments_json = VALUES(attachments_json), updated_at = NOW()`,
				req.AssessmentID,
				answer.QuestionID,
				string(raw),
				attachments,
			)
			if err != nil {
				response.Error(c, http.StatusInternalServerError, "ASSESSMENT_SUBMIT_FAILED", "failed to submit assessment")
				return
			}
		}
		_, _ = db.ExecContext(c, `UPDATE assessment_sessions SET status = 'submitted', submitted_at = NOW() WHERE assessment_id = ?`, req.AssessmentID)
		response.OK(c, gin.H{"submitted": true})
	}
}

func GradeAssessment(agentServiceURL, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req assessmentIDReq
		if err := c.ShouldBindJSON(&req); err != nil || req.AssessmentID == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "assessmentId is required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		result, err := gradeAssessment(c, db, agentServiceURL, internalToken, req.AssessmentID)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ASSESSMENT_GRADE_FAILED", "failed to grade assessment")
			return
		}
		response.OK(c, result)
	}
}

func GetAssessmentDetail() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req assessmentIDReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "assessmentId is required")
			return
		}
		assessmentID := strings.TrimSpace(firstNonEmptyString(req.AssessmentID, req.ID))
		if assessmentID == "" || assessmentID == "undefined" || assessmentID == "null" {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "assessmentId is required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		detail, err := queryAssessmentDetail(c, db, assessmentID)
		if err != nil {
			log.Printf("queryAssessmentDetail failed assessment_id=%s err=%v", assessmentID, err)
			response.Error(c, http.StatusNotFound, "ASSESSMENT_NOT_FOUND", "assessment not found")
			return
		}
		response.OK(c, detail)
	}
}

func ListAssessments() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req assessmentListReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid assessment list body")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, _ := latestUserID(c, db)
		page, pageSize := normalizePage(req.Page, req.PageSize)
		query := `SELECT a.assessment_id, a.subject_id, COALESCE(s.name, ''), a.source, a.mode, a.status,
			a.knowledge_points_json, a.total_score, a.created_at, a.submitted_at, a.graded_at,
			(SELECT COUNT(1) FROM assessment_questions q WHERE q.assessment_id = a.assessment_id),
			(SELECT COUNT(1) FROM assessment_answers ans WHERE ans.assessment_id = a.assessment_id),
			(SELECT COALESCE(SUM(q.score), 0) FROM assessment_questions q WHERE q.assessment_id = a.assessment_id)
			FROM assessment_sessions a
			LEFT JOIN subjects s ON s.id = a.subject_id
			WHERE a.user_id = ?`
		args := []any{userID}
		if req.SubjectID != nil {
			query += ` AND a.subject_id = ?`
			args = append(args, *req.SubjectID)
		} else if req.Scope == "unassigned" {
			query += ` AND a.subject_id IS NULL`
		}
		if req.Status != "" {
			query += ` AND a.status = ?`
			args = append(args, req.Status)
		}
		query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`
		args = append(args, pageSize, (page-1)*pageSize)
		rows, err := db.QueryContext(c, query, args...)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ASSESSMENT_LIST_FAILED", "failed to list assessments")
			return
		}
		defer rows.Close()
		list := []gin.H{}
		for rows.Next() {
			var id, source, mode, status, pointsRaw, createdAt, subjectName string
			var subjectID sql.NullInt64
			var totalScore sql.NullFloat64
			var submittedAt, gradedAt sql.NullString
			var questionCount, answeredCount int
			var maxScore float64
			if err := rows.Scan(&id, &subjectID, &subjectName, &source, &mode, &status, &pointsRaw, &totalScore, &createdAt, &submittedAt, &gradedAt, &questionCount, &answeredCount, &maxScore); err != nil {
				response.Error(c, http.StatusInternalServerError, "ASSESSMENT_LIST_FAILED", "failed to scan assessments")
				return
			}
			var knowledgePoints []assessmentKnowledgePointReq
			_ = json.Unmarshal([]byte(pointsRaw), &knowledgePoints)
			list = append(list, gin.H{
				"id":              id,
				"title":           buildAssessmentTitle(subjectName, id),
				"subjectId":       nullableSubjectID(subjectID),
				"subjectName":     nullableResponseString(subjectName),
				"source":          source,
				"sourceLabel":     assessmentSourceLabel(source),
				"mode":            mode,
				"status":          status,
				"statusLabel":     assessmentStatusLabel(status),
				"knowledgePoints": knowledgePoints,
				"questionCount":   questionCount,
				"generatedCount":  questionCount,
				"answeredCount":   answeredCount,
				"totalScore":      nullableFloat(totalScore),
				"maxScore":        maxScore,
				"createdAt":       createdAt,
				"displayTime":     displayAssessmentTime(createdAt),
				"submittedAt":     nullableSQLString(submittedAt),
				"gradedAt":        nullableSQLString(gradedAt),
			})
		}
		response.OK(c, gin.H{"list": list, "page": page, "pageSize": pageSize})
	}
}

func validateGenerationConfig(req generateAssessmentReq) error {
	if len(req.KnowledgePoints) == 0 {
		return httpError("knowledgePoints cannot be empty")
	}
	total := 0
	for _, item := range req.GenerationConfig.QuestionTypes {
		if item.Count < 0 {
			return httpError("question type count cannot be negative")
		}
		total += item.Count
	}
	if total <= 0 || total > 50 {
		return httpError("total question count must be between 1 and 50")
	}
	return nil
}

func totalConfiguredQuestions(req generateAssessmentReq) int {
	total := 0
	for _, item := range req.GenerationConfig.QuestionTypes {
		total += item.Count
	}
	return total
}

func createAssessmentSession(c *gin.Context, db *sql.DB, assessmentID string, userID string, req generateAssessmentReq, status string) error {
	configRaw, _ := json.Marshal(req.GenerationConfig)
	pointsRaw, _ := json.Marshal(req.KnowledgePoints)
	mode := defaultString(req.GenerationConfig.Mode, "quick_practice")
	source := defaultString(req.Source, "manual")
	_, err := db.ExecContext(
		c,
		`INSERT INTO assessment_sessions
		(assessment_id, user_id, subject_id, source, mode, status, generation_config_json,
		 knowledge_points_json, time_limit_seconds, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
		assessmentID,
		userID,
		req.SubjectID,
		source,
		mode,
		status,
		string(configRaw),
		string(pointsRaw),
		req.GenerationConfig.TimeLimitSeconds,
	)
	return err
}

func validateAssessmentQuestionPayload(question gin.H) error {
	questionType := toString(question["questionType"])
	stem := strings.TrimSpace(toString(question["stem"]))
	if stem == "" {
		return httpError("题目生成失败：题干为空")
	}
	if questionType == "single_choice" || questionType == "multiple_choice" {
		options, ok := question["options"].([]any)
		if !ok {
			if typed, typedOK := question["options"].([]gin.H); typedOK {
				options = make([]any, 0, len(typed))
				for _, item := range typed {
					options = append(options, item)
				}
			}
		}
		if len(options) < 2 {
			return httpError("题目生成失败：客观题选项缺失，请重新生成")
		}
	}
	return nil
}

type httpError string

func (e httpError) Error() string { return string(e) }

func buildAssessmentQuestions(assessmentID string, req generateAssessmentReq) []gin.H {
	questions := []gin.H{}
	idx := 0
	for _, typeCfg := range req.GenerationConfig.QuestionTypes {
		for i := 0; i < typeCfg.Count; i++ {
			point := req.KnowledgePoints[idx%len(req.KnowledgePoints)]
			idx++
			questions = append(questions, buildQuestion(assessmentID, point, typeCfg.Type, idx, req.GenerationConfig.Difficulty))
		}
	}
	return questions
}

func buildQuestion(assessmentID string, point assessmentKnowledgePointReq, questionType string, idx int, difficulty string) gin.H {
	id := "q_" + uuid.NewString()
	stem := "请完成关于「" + point.Label + "」的" + questionTypeName(questionType) + "。"
	answer := any("A")
	options := any(nil)
	rubric := any(nil)
	explanation := "本题用于检查你对「" + point.Label + "」的理解。"
	switch questionType {
	case "single_choice":
		options = []gin.H{{"id": "A", "text": "正确理解该知识点"}, {"id": "B", "text": "与该知识点无关"}, {"id": "C", "text": "只记忆名称"}, {"id": "D", "text": "忽略适用条件"}}
		answer = "A"
	case "true_false":
		stem = "判断：掌握「" + point.Label + "」时，需要同时理解概念和适用条件。"
		answer = true
	case "fill_blank":
		stem = "填空：「" + point.Label + "」的核心关键词是____。"
		answer = []string{point.Label}
	case "short_answer":
		answer = "围绕概念、关键条件和典型应用进行说明。"
		rubric = []gin.H{{"criterion": "说明核心概念", "points": 4}, {"criterion": "解释适用条件", "points": 3}, {"criterion": "表达清晰", "points": 3}}
	}
	return gin.H{
		"id":           id,
		"assessmentId": assessmentID,
		"knowledgeKey": point.KnowledgeKey,
		"questionType": questionType,
		"stem":         stem,
		"options":      options,
		"answer":       answer,
		"rubric":       rubric,
		"difficulty":   normalizeDifficulty(difficulty),
		"score":        10,
		"explanation":  explanation,
		"order":        idx,
	}
}

func insertAssessmentQuestion(c *gin.Context, db *sql.DB, question gin.H) error {
	optionsRaw, _ := json.Marshal(question["options"])
	answerRaw, _ := json.Marshal(question["answer"])
	rubricRaw, _ := json.Marshal(question["rubric"])
	_, err := db.ExecContext(
		c,
		`INSERT INTO assessment_questions
		(question_id, assessment_id, knowledge_key, question_type, stem, options_json, answer_json,
		 rubric_json, difficulty, score, explanation, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
		question["id"],
		question["assessmentId"],
		question["knowledgeKey"],
		question["questionType"],
		question["stem"],
		string(optionsRaw),
		string(answerRaw),
		string(rubricRaw),
		question["difficulty"],
		question["score"],
		question["explanation"],
	)
	return err
}

func questionTypeName(questionType string) string {
	names := map[string]string{"single_choice": "选择题", "fill_blank": "填空题", "true_false": "判断题", "short_answer": "问答题"}
	if name := names[questionType]; name != "" {
		return name
	}
	return "题目"
}

func normalizeDifficulty(value string) string {
	if value == "easy" || value == "medium" || value == "hard" {
		return value
	}
	return "medium"
}

func normalizePage(page, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}

func buildAssessmentTitle(subjectName string, assessmentID string) string {
	if strings.TrimSpace(subjectName) != "" {
		return subjectName + "专项训练"
	}
	if len(assessmentID) > 8 {
		return "专项训练 " + assessmentID[len(assessmentID)-8:]
	}
	return "专项训练"
}

func assessmentSourceLabel(source string) string {
	switch source {
	case "weak_point":
		return "薄弱点推荐"
	case "manual":
		return "手动生成"
	default:
		return "系统生成"
	}
}

func assessmentStatusLabel(status string) string {
	switch status {
	case "generating":
		return "生成中"
	case "answering", "generated", "draft":
		return "待作答"
	case "submitted":
		return "待批改"
	case "graded":
		return "已批改"
	case "failed":
		return "生成失败"
	default:
		return status
	}
}

func displayAssessmentTime(raw string) string {
	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return raw
	}
	now := time.Now()
	if parsed.Year() == now.Year() && parsed.YearDay() == now.YearDay() {
		return "今天 " + parsed.Format("15:04")
	}
	return parsed.Format("01-02 15:04")
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func requestAssessmentGeneration(
	c *gin.Context,
	agentServiceURL string,
	internalToken string,
	userID string,
	assessmentID string,
	req generateAssessmentReq,
) ([]gin.H, error) {
	payload := map[string]any{
		"userId":           userID,
		"assessmentId":     assessmentID,
		"traceId":          c.GetString("request_id"),
		"subjectId":        req.SubjectID,
		"source":           req.Source,
		"knowledgePoints":  req.KnowledgePoints,
		"generationConfig": req.GenerationConfig,
	}
	var result struct {
		Questions []gin.H `json:"questions"`
	}
	if err := postAgentJSON(c, agentServiceURL+"/assessments/generate", internalToken, payload, &result); err != nil {
		return nil, err
	}
	return result.Questions, nil
}

func gradeAssessment(c *gin.Context, db *sql.DB, agentServiceURL string, internalToken string, assessmentID string) (gin.H, error) {
	questions, err := queryAssessmentQuestions(c, db, assessmentID)
	if err != nil {
		return nil, err
	}
	userAnswers, err := queryAssessmentAnswerInputs(c, db, assessmentID)
	if err != nil {
		return nil, err
	}
	userID, subjectID, source, err := assessmentOwner(c, db, assessmentID)
	if err != nil {
		return nil, err
	}

	payload := map[string]any{
		"userId":       userID,
		"assessmentId": assessmentID,
		"traceId":      c.GetString("request_id"),
		"questions":    questions,
		"answers":      userAnswers,
	}
	var agentResult struct {
		TotalScore      float64  `json:"totalScore"`
		MaxScore        float64  `json:"maxScore"`
		Answers         []gin.H  `json:"answers"`
		Recommendations []string `json:"recommendations"`
	}
	if err := postAgentJSON(c, agentServiceURL+"/assessments/grade", internalToken, payload, &agentResult); err != nil {
		return nil, err
	}

	weakChanges := []gin.H{}
	for _, item := range agentResult.Answers {
		questionID := toString(item["questionId"])
		isCorrect, _ := item["isCorrect"].(bool)
		score := toFloat(item["score"])
		scoreRatio := toFloat(item["scoreRatio"])
		feedback := toString(item["feedback"])
		rubricRaw, _ := json.Marshal(item["rubricScores"])
		_, err := db.ExecContext(
			c,
			`UPDATE assessment_answers
			 SET is_correct = ?, score = ?, score_ratio = ?, feedback = ?, rubric_scores_json = ?, graded_by = 'agent', updated_at = NOW()
			 WHERE assessment_id = ? AND question_id = ?`,
			isCorrect,
			score,
			scoreRatio,
			feedback,
			string(rubricRaw),
			assessmentID,
			questionID,
		)
		if err != nil {
			return nil, err
		}
		knowledgeKey := findQuestionKnowledgeKey(questions, questionID)
		eventType := "assessment_wrong"
		if isCorrect {
			eventType = "assessment_correct"
		}
		_ = emitAssessmentEvent(c, db, userID, subjectID, source, eventType, []assessmentKnowledgePointReq{{KnowledgeKey: knowledgeKey, Label: knowledgeKey}})
		weakChanges = append(weakChanges, gin.H{"knowledgeKey": knowledgeKey})
	}
	_, err = db.ExecContext(
		c,
		`UPDATE assessment_sessions SET status = 'graded', total_score = ?, graded_at = NOW() WHERE assessment_id = ?`,
		agentResult.TotalScore,
		assessmentID,
	)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"assessmentId":     assessmentID,
		"totalScore":       agentResult.TotalScore,
		"maxScore":         agentResult.MaxScore,
		"answers":          agentResult.Answers,
		"weakPointChanges": weakChanges,
		"recommendations":  agentResult.Recommendations,
	}, nil
}

func assessmentOwner(c *gin.Context, db *sql.DB, assessmentID string) (string, *int, string, error) {
	var userID, source string
	var subject sql.NullInt64
	err := db.QueryRowContext(
		c,
		`SELECT user_id, subject_id, source FROM assessment_sessions WHERE assessment_id = ?`,
		assessmentID,
	).Scan(&userID, &subject, &source)
	if err != nil {
		return "", nil, "", err
	}
	if subject.Valid {
		value := int(subject.Int64)
		return userID, &value, source, nil
	}
	return userID, nil, source, nil
}

func queryAssessmentDetail(c *gin.Context, db *sql.DB, assessmentID string) (gin.H, error) {
	var userID, source, mode, status, configRaw, pointsRaw, createdAt, subjectName string
	var subjectID sql.NullInt64
	var totalScore sql.NullFloat64
	var submittedAt, gradedAt sql.NullString
	err := db.QueryRowContext(
		c,
		`SELECT a.user_id, a.subject_id, COALESCE(s.name, ''), a.source, a.mode, a.status, a.generation_config_json, a.knowledge_points_json,
		 a.total_score, a.created_at, a.submitted_at, a.graded_at
		 FROM assessment_sessions a
		 LEFT JOIN subjects s ON s.id = a.subject_id
		 WHERE a.assessment_id = ?`,
		assessmentID,
	).Scan(&userID, &subjectID, &subjectName, &source, &mode, &status, &configRaw, &pointsRaw, &totalScore, &createdAt, &submittedAt, &gradedAt)
	if err != nil {
		return nil, err
	}
	questions, err := queryAssessmentQuestions(c, db, assessmentID)
	if err != nil {
		return nil, err
	}
	answers, _ := queryAssessmentAnswerInputs(c, db, assessmentID)
	gradeResults, _ := queryAssessmentGradeResults(c, db, assessmentID)
	maxScore := 0.0
	for _, question := range questions {
		maxScore += toFloat(question["score"])
	}
	var config any
	var points any
	_ = json.Unmarshal([]byte(configRaw), &config)
	_ = json.Unmarshal([]byte(pointsRaw), &points)
	return gin.H{
		"id":               assessmentID,
		"title":            buildAssessmentTitle(subjectName, assessmentID),
		"userId":           userID,
		"subjectId":        nullableSubjectID(subjectID),
		"subjectName":      nullableResponseString(subjectName),
		"source":           source,
		"sourceLabel":      assessmentSourceLabel(source),
		"mode":             mode,
		"status":           status,
		"statusLabel":      assessmentStatusLabel(status),
		"generationConfig": config,
		"knowledgePoints":  points,
		"questions":        questions,
		"questionCount":    len(questions),
		"generatedCount":   len(questions),
		"answeredCount":    len(answers),
		"totalScore":       nullableFloat(totalScore),
		"maxScore":         maxScore,
		"createdAt":        createdAt,
		"displayTime":      displayAssessmentTime(createdAt),
		"submittedAt":      nullableSQLString(submittedAt),
		"gradedAt":         nullableSQLString(gradedAt),
		"answers":          answers,
		"gradeResults":     gradeResults,
	}, nil
}

func queryAssessmentQuestions(c *gin.Context, db *sql.DB, assessmentID string) ([]gin.H, error) {
	rows, err := db.QueryContext(
		c,
		`SELECT question_id, knowledge_key, question_type, stem, options_json, answer_json,
		 rubric_json, difficulty, score, explanation
		 FROM assessment_questions WHERE assessment_id = ? ORDER BY id ASC`,
		assessmentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	questions := []gin.H{}
	for rows.Next() {
		var id, key, questionType, stem, optionsRaw, answerRaw, rubricRaw, difficulty, explanation string
		var score float64
		if err := rows.Scan(&id, &key, &questionType, &stem, &optionsRaw, &answerRaw, &rubricRaw, &difficulty, &score, &explanation); err != nil {
			return nil, err
		}
		questions = append(questions, gin.H{
			"id":           id,
			"assessmentId": assessmentID,
			"knowledgeKey": key,
			"questionType": questionType,
			"stem":         stem,
			"options":      decodeJSON(optionsRaw),
			"answer":       decodeJSON(answerRaw),
			"rubric":       decodeJSON(rubricRaw),
			"difficulty":   difficulty,
			"score":        score,
			"explanation":  explanation,
		})
	}
	return questions, rows.Err()
}

func queryAssessmentAnswerInputs(c *gin.Context, db *sql.DB, assessmentID string) ([]gin.H, error) {
	rows, err := db.QueryContext(
		c,
		`SELECT question_id, user_answer_json, COALESCE(attachments_json, '[]') FROM assessment_answers WHERE assessment_id = ? ORDER BY id ASC`,
		assessmentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	answers := []gin.H{}
	for rows.Next() {
		var questionID, raw, attachmentsRaw string
		if err := rows.Scan(&questionID, &raw, &attachmentsRaw); err != nil {
			return nil, err
		}
		answers = append(answers, gin.H{
			"questionId":  questionID,
			"answer":      decodeJSON(raw),
			"attachments": decodeJSON(attachmentsRaw),
		})
	}
	return answers, rows.Err()
}

func queryAssessmentGradeResults(c *gin.Context, db *sql.DB, assessmentID string) ([]gin.H, error) {
	rows, err := db.QueryContext(
		c,
		`SELECT question_id, is_correct, score, COALESCE(score_ratio, 0), COALESCE(feedback, ''), COALESCE(rubric_scores_json, '[]')
		 FROM assessment_answers WHERE assessment_id = ? ORDER BY id ASC`,
		assessmentID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	results := []gin.H{}
	for rows.Next() {
		var questionID, feedback, rubricRaw string
		var isCorrect bool
		var score, scoreRatio float64
		if err := rows.Scan(&questionID, &isCorrect, &score, &scoreRatio, &feedback, &rubricRaw); err != nil {
			return nil, err
		}
		results = append(results, gin.H{
			"questionId":   questionID,
			"isCorrect":    isCorrect,
			"score":        score,
			"scoreRatio":   scoreRatio,
			"feedback":     feedback,
			"rubricScores": decodeJSON(rubricRaw),
		})
	}
	return results, rows.Err()
}

func postAgentJSON(c *gin.Context, url string, internalToken string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if internalToken != "" {
		req.Header.Set("x-internal-token", internalToken)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	resBody, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}
	if res.StatusCode >= 400 {
		return httpError(string(resBody))
	}
	return json.Unmarshal(resBody, out)
}

func findQuestionKnowledgeKey(questions []gin.H, questionID string) string {
	for _, question := range questions {
		if toString(question["id"]) == questionID {
			return toString(question["knowledgeKey"])
		}
	}
	return questionID
}

func toFloat(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case json.Number:
		parsed, _ := typed.Float64()
		return parsed
	default:
		return 0
	}
}

func emitAssessmentEvent(c *gin.Context, db *sql.DB, userID string, subjectID *int, source, eventType string, points []assessmentKnowledgePointReq) error {
	for _, point := range points {
		label := point.Label
		if label == "" {
			label = point.KnowledgeKey
		}
		req := createLearningEventReq{
			UserID:         userID,
			SubjectID:      subjectID,
			KnowledgeKey:   point.KnowledgeKey,
			KnowledgePoint: label,
			Difficulty:     "medium",
			SourceType:     source,
			EventType:      eventType,
		}
		if req.KnowledgeKey == "" {
			req.KnowledgeKey = normalizeKnowledgeKey(subjectID, label)
		}
		req.EventID = "le_" + uuid.NewString()
		if _, err := db.ExecContext(
			c,
			`INSERT INTO learning_events
			(event_id, user_id, subject_id, knowledge_key, knowledge_point, difficulty, source_type, event_type, metadata_json, occurred_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', NOW(), NOW())`,
			req.EventID,
			req.UserID,
			req.SubjectID,
			req.KnowledgeKey,
			req.KnowledgePoint,
			req.Difficulty,
			req.SourceType,
			req.EventType,
		); err != nil {
			return err
		}
		if err := upsertLearningStats(c, db, req, req.KnowledgeKey); err != nil {
			return err
		}
	}
	return nil
}

func normalizeJSON(raw string) string {
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return strings.TrimSpace(raw)
	}
	normalized, _ := json.Marshal(value)
	return string(normalized)
}

func decodeJSON(raw string) any {
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil
	}
	return value
}

func nullableFloat(value sql.NullFloat64) any {
	if !value.Valid {
		return nil
	}
	return value.Float64
}

func nullableSQLString(value sql.NullString) any {
	if !value.Valid {
		return nil
	}
	return value.String
}
