package handlers

import (
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"tutor-server/internal/http/response"
)

type createLearningEventReq struct {
	EventID             string          `json:"eventId"`
	UserID              string          `json:"userId"`
	SessionID           string          `json:"sessionId"`
	ConversationID      string          `json:"conversationId"`
	MessageID           string          `json:"messageId"`
	SubjectID           *int            `json:"subjectId"`
	SubjectNameSnapshot string          `json:"subjectNameSnapshot"`
	Chapter             string          `json:"chapter"`
	KnowledgeKey        string          `json:"knowledgeKey"`
	KnowledgePoint      string          `json:"knowledgePoint"`
	Difficulty          string          `json:"difficulty"`
	SourceType          string          `json:"sourceType"`
	EventType           string          `json:"eventType"`
	Confidence          *float64        `json:"confidence"`
	Metadata            json.RawMessage `json:"metadata"`
}

func CreateLearningEvent() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createLearningEventReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid learning event body")
			return
		}
		if strings.TrimSpace(req.UserID) == "" || strings.TrimSpace(req.KnowledgePoint) == "" || strings.TrimSpace(req.EventType) == "" {
			response.Error(c, http.StatusBadRequest, "INVALID_LEARNING_EVENT_FIELDS", "userId, knowledgePoint and eventType are required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		eventID := req.EventID
		if eventID == "" {
			eventID = "le_" + uuid.NewString()
		}
		knowledgeKey := req.KnowledgeKey
		if knowledgeKey == "" {
			knowledgeKey = normalizeKnowledgeKey(req.SubjectID, req.KnowledgePoint)
		}
		difficulty := req.Difficulty
		if difficulty == "" {
			difficulty = "medium"
		}
		sourceType := req.SourceType
		if sourceType == "" {
			sourceType = "qa"
		}
		metadata := string(req.Metadata)
		if metadata == "" {
			metadata = "{}"
		}

		_, err := db.ExecContext(
			c,
			`INSERT INTO learning_events
			(event_id, user_id, session_id, conversation_id, message_id, subject_id, subject_name_snapshot,
			 chapter, knowledge_key, knowledge_point, difficulty, source_type, event_type, confidence,
			 metadata_json, occurred_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			eventID,
			req.UserID,
			nullableString(req.SessionID),
			nullableString(req.ConversationID),
			nullableString(req.MessageID),
			req.SubjectID,
			nullableString(req.SubjectNameSnapshot),
			nullableString(req.Chapter),
			knowledgeKey,
			req.KnowledgePoint,
			difficulty,
			sourceType,
			req.EventType,
			req.Confidence,
			metadata,
		)
		if err != nil {
			fmt.Printf("[LearningEvent] create failed user_id=%s event_type=%s err=%v\n", req.UserID, req.EventType, err)
			response.Error(c, http.StatusInternalServerError, "LEARNING_EVENT_CREATE_FAILED", "failed to create learning event")
			return
		}
		if err := upsertLearningStats(c, db, req, knowledgeKey); err != nil {
			fmt.Printf("[LearningEvent] stats upsert failed user_id=%s knowledge_key=%s err=%v\n", req.UserID, knowledgeKey, err)
			response.Error(c, http.StatusInternalServerError, "LEARNING_STATS_UPDATE_FAILED", "failed to update learning stats")
			return
		}
		response.Created(c, gin.H{"eventId": eventID, "knowledgeKey": knowledgeKey})
	}
}

func upsertLearningStats(c *gin.Context, db *sql.DB, req createLearningEventReq, knowledgeKey string) error {
	askDelta, testDelta, correctDelta, wrongDelta := eventDeltas(req.EventType)
	stats, err := readLearningStats(c, db, req.UserID, req.SubjectID, knowledgeKey)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	stats.AskCount += askDelta
	stats.TestCount += testDelta
	stats.CorrectCount += correctDelta
	stats.WrongCount += wrongDelta
	stats.MasteryScore, stats.WeaknessScore = calculateLearningScores(stats)

	_, err = db.ExecContext(
		c,
		`INSERT INTO learning_knowledge_stats
		(user_id, subject_id, knowledge_key, knowledge_point, ask_count, test_count, correct_count, wrong_count,
		 mastery_score, weakness_score, last_activity_at, formula_version, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'v1', NOW(), NOW())
		 ON DUPLICATE KEY UPDATE
		   knowledge_point = VALUES(knowledge_point),
		   ask_count = VALUES(ask_count),
		   test_count = VALUES(test_count),
		   correct_count = VALUES(correct_count),
		   wrong_count = VALUES(wrong_count),
		   mastery_score = VALUES(mastery_score),
		   weakness_score = VALUES(weakness_score),
		   last_activity_at = NOW(),
		   updated_at = NOW()`,
		req.UserID,
		req.SubjectID,
		knowledgeKey,
		req.KnowledgePoint,
		stats.AskCount,
		stats.TestCount,
		stats.CorrectCount,
		stats.WrongCount,
		stats.MasteryScore,
		stats.WeaknessScore,
	)
	return err
}

type learningStatsCounter struct {
	AskCount      int
	TestCount     int
	CorrectCount  int
	WrongCount    int
	MasteryScore  float64
	WeaknessScore float64
}

func readLearningStats(c *gin.Context, db *sql.DB, userID string, subjectID *int, knowledgeKey string) (learningStatsCounter, error) {
	var stats learningStatsCounter
	query := `SELECT ask_count, test_count, correct_count, wrong_count, mastery_score, weakness_score
		FROM learning_knowledge_stats WHERE user_id = ? AND knowledge_key = ? AND `
	args := []any{userID, knowledgeKey}
	if subjectID == nil {
		query += `subject_id IS NULL`
	} else {
		query += `subject_id = ?`
		args = append(args, *subjectID)
	}
	err := db.QueryRowContext(c, query, args...).Scan(
		&stats.AskCount,
		&stats.TestCount,
		&stats.CorrectCount,
		&stats.WrongCount,
		&stats.MasteryScore,
		&stats.WeaknessScore,
	)
	return stats, err
}

func eventDeltas(eventType string) (askDelta, testDelta, correctDelta, wrongDelta int) {
	switch eventType {
	case "qa_extracted", "qa_subject_unmatched":
		return 1, 0, 0, 0
	case "assessment_generated":
		return 0, 1, 0, 0
	case "assessment_graded":
		return 0, 1, 0, 0
	case "assessment_correct":
		return 0, 1, 1, 0
	case "assessment_wrong":
		return 0, 1, 0, 1
	case "manual_reviewed":
		return 0, 0, 1, 0
	default:
		return 0, 0, 0, 0
	}
}

func calculateLearningScores(stats learningStatsCounter) (float64, float64) {
	testBase := math.Max(float64(stats.TestCount), 1)
	accuracy := float64(stats.CorrectCount) / testBase
	wrongRate := float64(stats.WrongCount) / testBase
	repeatedAskPenalty := math.Min(float64(stats.AskCount)/10, 1)

	mastery := 50 + accuracy*35 - wrongRate*25 - repeatedAskPenalty*10
	weakness := wrongRate*45 + repeatedAskPenalty*15
	return clampScore(mastery), clampScore(weakness)
}

func clampScore(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return math.Round(value*100) / 100
}

func normalizeKnowledgeKey(subjectID *int, point string) string {
	normalized := strings.ToLower(strings.TrimSpace(point))
	normalized = regexp.MustCompile(`\s+`).ReplaceAllString(normalized, "-")
	hash := sha1.Sum([]byte(normalized))
	prefix := "global"
	if subjectID != nil {
		prefix = fmt.Sprintf("subject:%d", *subjectID)
	}
	return prefix + ":temp:" + hex.EncodeToString(hash[:])[:12]
}

func nullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
