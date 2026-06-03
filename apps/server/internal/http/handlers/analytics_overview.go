package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

type analyticsOverviewReq struct {
	Scope     string `json:"scope"`
	SubjectID *int   `json:"subjectId"`
}

type analyticsSummaryReq struct {
	Scope     string `json:"scope"`
	SubjectID *int   `json:"subjectId"`
}

func GetAnalyticsOverview() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req analyticsOverviewReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid analytics overview body")
			return
		}
		if req.Scope == "" {
			req.Scope = "overall"
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, _ := latestUserID(c, db)
		if userID == "" {
			userID = "0"
		}

		subjectName := ""
		if req.Scope == "subject" && req.SubjectID != nil {
			_ = db.QueryRowContext(c, `SELECT name FROM subjects WHERE id = ?`, *req.SubjectID).Scan(&subjectName)
		}
		weakPoints, wordCloud, err := queryAnalyticsWeakPoints(c, db, userID, req)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "ANALYTICS_QUERY_FAILED", "failed to query analytics")
			return
		}
		distribution, _ := querySubjectDistribution(c, db, userID)
		cards := buildAnalyticsCards(weakPoints, distribution)
		latestSummary, _ := queryLatestAnalyticsSummary(c, db, userID, req.SubjectID)
		trend := []gin.H{{
			"date":          time.Now().UTC().Format("2006-01-02"),
			"masteryScore":  cards["masteryScore"],
			"questionCount": cards["totalQuestions"],
			"testCount":     0,
			"wrongCount":    0,
		}}
		response.OK(c, gin.H{
			"scope":               req.Scope,
			"userId":              userID,
			"subjectId":           req.SubjectID,
			"subjectName":         nullableResponseString(subjectName),
			"cards":               cards,
			"subjectDistribution": distribution,
			"weakPoints":          weakPoints,
			"wordCloud":           wordCloud,
			"masteryTrend":        trend,
			"activityHeatmap":     []gin.H{},
			"knowledgeGraph":      buildKnowledgeGraph(weakPoints),
			"recommendations":     buildAnalyticsRecommendations(weakPoints),
			"summary":             latestSummary["summary"],
			"summaryGeneratedAt":  latestSummary["summaryGeneratedAt"],
			"summaryDetail":       latestSummary,
			"updatedAt":           time.Now().UTC().Format(time.RFC3339),
		})
	}
}

func GenerateAnalyticsSummaryV2(agentServiceURL, internalToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req analyticsSummaryReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid analytics summary body")
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
		overviewReq := analyticsOverviewReq{Scope: req.Scope, SubjectID: req.SubjectID}
		if overviewReq.Scope == "" {
			overviewReq.Scope = "overall"
		}
		weakPoints, wordCloud, _ := queryAnalyticsWeakPoints(c, db, userID, overviewReq)
		distribution, _ := querySubjectDistribution(c, db, userID)
		cards := buildAnalyticsCards(weakPoints, distribution)
		summaryPayload := gin.H{
			"userId":    userID,
			"scope":     overviewReq.Scope,
			"subjectId": req.SubjectID,
			"analytics": gin.H{
				"cards":               cards,
				"weakPoints":          weakPoints,
				"wordCloud":           wordCloud,
				"subjectDistribution": distribution,
			},
			"recentEvents":      []gin.H{},
			"recentAssessments": []gin.H{},
			"traceId":           c.GetString("request_id"),
		}
		var agentResult struct {
			Summary            string   `json:"summary"`
			Highlights         []string `json:"highlights"`
			WeakPointAnalysis  []string `json:"weakPointAnalysis"`
			RecommendedActions []gin.H  `json:"recommendedActions"`
			RiskLevel          string   `json:"riskLevel"`
		}
		if err := postAgentJSON(c, agentServiceURL+"/learning-summary/generate", internalToken, summaryPayload, &agentResult); err != nil {
			response.Error(c, http.StatusInternalServerError, "ANALYTICS_SUMMARY_AGENT_FAILED", "failed to generate analytics summary")
			return
		}
		summary := agentResult.Summary
		var subjectID any
		if req.SubjectID != nil {
			subjectID = *req.SubjectID
		}
		if err := saveAnalyticsSummary(c, db, userID, subjectID, summary); err != nil {
			response.Error(c, http.StatusInternalServerError, "ANALYTICS_UPDATE_FAILED", "failed to update analytics summary")
			return
		}
		response.OK(c, gin.H{"summary": summary})
	}
}

func queryLatestAnalyticsSummary(c *gin.Context, db *sql.DB, userID string, subjectID *int) (gin.H, error) {
	query := `SELECT summary, summary_generated_at FROM analytics_summaries WHERE user_id = ?`
	args := []any{userID}
	if subjectID == nil {
		query += ` AND subject_id IS NULL`
	} else {
		query += ` AND subject_id = ?`
		args = append(args, *subjectID)
	}
	query += ` ORDER BY summary_generated_at DESC LIMIT 1`

	var summary string
	var generatedAt string
	err := db.QueryRowContext(c, query, args...).Scan(&summary, &generatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return gin.H{
		"summary":            summary,
		"highlights":         []string{},
		"weakPointAnalysis":  []string{},
		"recommendedActions": []gin.H{},
		"riskLevel":          "low",
		"generatedAt":        generatedAt,
		"summaryGeneratedAt": generatedAt,
	}, nil
}

func saveAnalyticsSummary(c *gin.Context, db *sql.DB, userID string, subjectID any, summary string) error {
	if subjectID == nil {
		result, err := db.ExecContext(
			c,
			`UPDATE analytics_summaries SET summary = ?, summary_generated_at = NOW(), updated_at = NOW()
			 WHERE user_id = ? AND subject_id IS NULL`,
			summary,
			userID,
		)
		if err != nil {
			return err
		}
		rows, _ := result.RowsAffected()
		if rows > 0 {
			return nil
		}
		_, err = db.ExecContext(
			c,
			`INSERT INTO analytics_summaries (user_id, subject_id, summary, summary_generated_at, updated_at)
			 VALUES (?, NULL, ?, NOW(), NOW())`,
			userID,
			summary,
		)
		return err
	}
	_, err := db.ExecContext(
		c,
		`INSERT INTO analytics_summaries (user_id, subject_id, summary, summary_generated_at, updated_at)
		 VALUES (?, ?, ?, NOW(), NOW())
		 ON DUPLICATE KEY UPDATE summary = VALUES(summary), summary_generated_at = NOW(), updated_at = NOW()`,
		userID,
		subjectID,
		summary,
	)
	return err
}

func queryAnalyticsWeakPoints(c *gin.Context, db *sql.DB, userID string, req analyticsOverviewReq) ([]gin.H, []gin.H, error) {
	query := `SELECT lks.knowledge_key, lks.knowledge_point, lks.subject_id, COALESCE(s.name, ''),
		lks.ask_count, lks.mastery_score, lks.weakness_score,
		CASE WHEN lks.test_count = 0 THEN 0 ELSE lks.correct_count / lks.test_count END
		FROM learning_knowledge_stats lks
		LEFT JOIN subjects s ON s.id = lks.subject_id
		WHERE lks.user_id = ?`
	args := []any{userID}
	if req.Scope == "subject" && req.SubjectID != nil {
		query += ` AND lks.subject_id = ?`
		args = append(args, *req.SubjectID)
	}
	query += ` ORDER BY lks.weakness_score DESC, lks.last_activity_at DESC LIMIT 30`

	rows, err := db.QueryContext(c, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	weakPoints := []gin.H{}
	wordCloud := []gin.H{}
	for rows.Next() {
		var key, point, subjectName string
		var subjectID sql.NullInt64
		var askCount int
		var mastery, weakness, accuracy float64
		if err := rows.Scan(&key, &point, &subjectID, &subjectName, &askCount, &mastery, &weakness, &accuracy); err != nil {
			return nil, nil, err
		}
		level := weaknessLevel(weakness)
		id := key
		weakPoints = append(weakPoints, gin.H{
			"id":            id,
			"knowledgeKey":  key,
			"keyword":       point,
			"level":         level,
			"count":         askCount,
			"subjectId":     nullableSubjectID(subjectID),
			"subjectName":   nullableResponseString(subjectName),
			"masteryScore":  mastery,
			"weaknessScore": weakness,
			"accuracyRate":  accuracy,
		})
		wordCloud = append(wordCloud, gin.H{
			"text":   point,
			"weight": askCount + int(weakness/10),
			"level":  level,
		})
	}
	return weakPoints, wordCloud, rows.Err()
}

func querySubjectDistribution(c *gin.Context, db *sql.DB, userID string) ([]gin.H, error) {
	rows, err := db.QueryContext(
		c,
		`SELECT lks.subject_id, COALESCE(s.name, '未归属学科'), COUNT(*), AVG(lks.mastery_score)
		 FROM learning_knowledge_stats lks
		 LEFT JOIN subjects s ON s.id = lks.subject_id
		 WHERE lks.user_id = ?
		 GROUP BY lks.subject_id, s.name
		 ORDER BY COUNT(*) DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []gin.H{}
	for rows.Next() {
		var subjectID sql.NullInt64
		var subjectName string
		var count int
		var mastery float64
		if err := rows.Scan(&subjectID, &subjectName, &count, &mastery); err != nil {
			return nil, err
		}
		list = append(list, gin.H{
			"subjectId":    nullableSubjectID(subjectID),
			"subjectName":  subjectName,
			"count":        count,
			"masteryScore": mastery,
		})
	}
	return list, rows.Err()
}

func buildAnalyticsCards(weakPoints []gin.H, distribution []gin.H) gin.H {
	totalQuestions := 0
	masteryTotal := 0.0
	for _, item := range distribution {
		if count, ok := item["count"].(int); ok {
			totalQuestions += count
		}
		if score, ok := item["masteryScore"].(float64); ok {
			masteryTotal += score
		}
	}
	masteryScore := 50
	if len(distribution) > 0 {
		masteryScore = int(masteryTotal / float64(len(distribution)))
	}
	return gin.H{
		"totalQuestions": totalQuestions,
		"activeDays":     1,
		"weakPointCount": len(weakPoints),
		"masteryScore":   masteryScore,
		"trend":          "+0%",
	}
}

func buildKnowledgeGraph(weakPoints []gin.H) []gin.H {
	nodes := make([]gin.H, 0, len(weakPoints))
	for _, item := range weakPoints {
		nodes = append(nodes, gin.H{
			"id":            item["knowledgeKey"],
			"label":         item["keyword"],
			"subjectId":     item["subjectId"],
			"parentId":      nil,
			"masteryScore":  item["masteryScore"],
			"weaknessScore": item["weaknessScore"],
		})
	}
	return nodes
}

func buildAnalyticsRecommendations(weakPoints []gin.H) []gin.H {
	recommendations := []gin.H{}
	for idx, item := range weakPoints {
		if idx >= 3 {
			break
		}
		recommendations = append(recommendations, gin.H{
			"id":           "rec-" + strconv.Itoa(idx+1),
			"type":         "assessment",
			"title":        "针对薄弱点生成测试",
			"description":  "建议围绕「" + toString(item["keyword"]) + "」进行专项练习。",
			"knowledgeKey": item["knowledgeKey"],
			"subjectId":    item["subjectId"],
		})
	}
	return recommendations
}

func weaknessLevel(score float64) string {
	if score >= 70 {
		return "high"
	}
	if score >= 40 {
		return "medium"
	}
	return "low"
}

func nullableSubjectID(value sql.NullInt64) any {
	if !value.Valid {
		return nil
	}
	return int(value.Int64)
}

func nullableResponseString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func toString(value any) string {
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}
