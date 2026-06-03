package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"tutor-server/internal/http/response"
)

type createSubjectReq struct {
	Name        string `json:"name"`
	ParentID    *int   `json:"parentId"`
	Description string `json:"description"`
}

type identifySubjectReq struct {
	ID int `json:"id"`
}

type updateSubjectReq struct {
	ID          int     `json:"id"`
	Name        *string `json:"name"`
	ParentID    *int    `json:"parentId"`
	Description *string `json:"description"`
}

type searchSubjectReq struct {
	Keyword string `json:"keyword"`
}

type internalListUserSubjectsReq struct {
	UserID string `json:"userId"`
}

type updateOutlineReq struct {
	ID      int            `json:"id"`
	Outline subjectOutline `json:"outline"`
}

func ListMySubjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		subjects, err := queryWebSubjects(c, db, "")
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "SUBJECTS_LIST_FAILED", "failed to list subjects")
			return
		}
		result := make([]webUserSubject, 0, len(subjects))
		for _, item := range subjects {
			result = append(result, webUserSubject{webSubject: item, IsOwner: true})
		}
		response.OK(c, gin.H{"list": result, "total": len(result)})
	}
}

func InternalListUserSubjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req internalListUserSubjectsReq
		if err := c.ShouldBindJSON(&req); err != nil || req.UserID == "" || req.UserID == "anonymous" {
			response.Error(c, http.StatusBadRequest, "INVALID_USER_ID", "userId is required")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		subjects, err := queryUserSubjects(c, db, req.UserID)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "USER_SUBJECTS_LIST_FAILED", "failed to list user subjects")
			return
		}
		result := make([]webUserSubject, 0, len(subjects))
		for _, item := range subjects {
			result = append(result, webUserSubject{webSubject: item, IsOwner: true})
		}
		response.OK(c, gin.H{"list": result, "total": len(result)})
	}
}

func SearchSubjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req searchSubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid search body")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		subjects, err := queryWebSubjects(c, db, req.Keyword)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "SUBJECTS_SEARCH_FAILED", "failed to search subjects")
			return
		}
		response.OK(c, gin.H{"list": subjects, "total": len(subjects)})
	}
}

func CreateSubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createSubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid subject body")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		level := 1
		if req.ParentID != nil {
			level = 2
		}
		subject := webSubject{
			Name: req.Name, ParentID: req.ParentID, Level: level,
			Description: req.Description, Outline: subjectOutline{Modules: []outlineModule{}},
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		}
		createdSubject, err := insertWebSubject(c, db, subject)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "SUBJECT_CREATE_FAILED", "failed to create subject")
			return
		}
		subject = createdSubject
		response.OK(c, gin.H{
			"id":          subject.ID,
			"name":        subject.Name,
			"parentId":    subject.ParentID,
			"level":       subject.Level,
			"description": subject.Description,
			"outline":     subject.Outline,
			"createdAt":   subject.CreatedAt,
			"updatedAt":   subject.UpdatedAt,
		})
	}
}

func UpdateSubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req updateSubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid subject body")
			return
		}
		id := req.ID
		if id <= 0 {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		subject, err := getWebSubjectByID(c, db, id)
		if err != nil {
			if err == sql.ErrNoRows {
				response.Error(c, http.StatusNotFound, "SUBJECT_NOT_FOUND", "subject not found")
				return
			}
			response.Error(c, http.StatusInternalServerError, "SUBJECT_QUERY_FAILED", "failed to query subject")
			return
		}
		if subject.ID == 0 {
			response.Error(c, http.StatusNotFound, "SUBJECT_NOT_FOUND", "subject not found")
			return
		}
		if req.Name != nil {
			subject.Name = *req.Name
		}
		if req.ParentID != nil {
			subject.ParentID = req.ParentID
			subject.Level = 2
		}
		if req.Description != nil {
			subject.Description = *req.Description
		}
		subject.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := updateWebSubject(c, db, subject); err != nil {
			response.Error(c, http.StatusInternalServerError, "SUBJECT_UPDATE_FAILED", "failed to update subject")
			return
		}
		response.OK(c, gin.H{
			"id":          subject.ID,
			"name":        subject.Name,
			"parentId":    subject.ParentID,
			"level":       subject.Level,
			"description": subject.Description,
			"outline":     subject.Outline,
			"createdAt":   subject.CreatedAt,
			"updatedAt":   subject.UpdatedAt,
		})
	}
}

func DeleteSubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifySubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid subject delete body")
			return
		}
		id := req.ID
		if id <= 0 {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		if err := deleteWebSubject(c, db, id); err != nil {
			response.Error(c, http.StatusInternalServerError, "SUBJECT_DELETE_FAILED", "failed to delete subject")
			return
		}
		response.OK(c, gin.H{"deleted": true})
	}
}

func AddMySubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			SubjectID int `json:"subjectId"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.SubjectID <= 0 {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid add body")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, err := latestUserID(c, db)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "USER_NOT_FOUND", "no user available")
			return
		}
		_, _ = db.ExecContext(
			c,
			`INSERT IGNORE INTO user_subjects (user_subject_id, user_id, subject_id) VALUES (?, ?, ?)`,
			"us-"+strconv.FormatInt(time.Now().UnixNano(), 10),
			userID,
			req.SubjectID,
		)
		response.OK(c, gin.H{"added": true})
	}
}

func RemoveMySubject() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifySubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid remove body")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		userID, err := latestUserID(c, db)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "USER_NOT_FOUND", "no user available")
			return
		}
		if req.ID > 0 {
			_, _ = db.ExecContext(c, `DELETE FROM user_subjects WHERE user_id = ? AND subject_id = ?`, userID, req.ID)
		}
		response.OK(c, gin.H{"removed": req.ID > 0})
	}
}

func GetSubjectOutline() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req identifySubjectReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid outline query body")
			return
		}
		id := req.ID
		if id <= 0 {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		outline := subjectOutline{Modules: []outlineModule{}}
		var raw string
		err := db.QueryRowContext(c, `SELECT outline_json FROM subject_outlines WHERE subject_id = ?`, id).Scan(&raw)
		if err == nil && raw != "" {
			_ = json.Unmarshal([]byte(raw), &outline)
		}
		response.OK(c, gin.H{"modules": outline.Modules})
	}
}

func UpdateSubjectOutline() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req updateOutlineReq
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Error(c, http.StatusBadRequest, "INVALID_BODY", "invalid outline body")
			return
		}
		id := req.ID
		if id <= 0 {
			response.Error(c, http.StatusBadRequest, "INVALID_SUBJECT_ID", "invalid subject id")
			return
		}
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		b, _ := json.Marshal(req.Outline)
		_, err := db.ExecContext(
			c,
			`INSERT INTO subject_outlines (subject_id, outline_json, updated_at) VALUES (?, ?, NOW())
			 ON DUPLICATE KEY UPDATE outline_json = VALUES(outline_json), updated_at = NOW()`,
			id,
			string(b),
		)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "OUTLINE_UPDATE_FAILED", "failed to update outline")
			return
		}
		_, _ = db.ExecContext(c, `UPDATE subjects SET updated_at = NOW() WHERE id = ?`, id)
		response.OK(c, gin.H{"updated": true})
	}
}

func AdminListSubjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		db, _, ok := dbOrError(c)
		if !ok {
			return
		}
		subjects, err := queryWebSubjects(c, db, "")
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "SUBJECTS_LIST_FAILED", "failed to list subjects")
			return
		}
		response.OK(c, gin.H{"list": subjects, "total": len(subjects)})
	}
}

func AdminDeleteSubject() gin.HandlerFunc {
	return DeleteSubject()
}

func queryWebSubjects(c *gin.Context, db *sql.DB, keyword string) ([]webSubject, error) {
	args := []any{}
	query := `SELECT s.id, s.name, s.parent_subject_id, s.level, s.description, s.created_at, s.updated_at,
		COALESCE(so.outline_json, '')
		FROM subjects s
		LEFT JOIN subject_outlines so ON so.subject_id = s.id`
	if keyword != "" {
		query += ` WHERE s.name LIKE ?`
		like := "%" + keyword + "%"
		args = append(args, like)
	}
	query += ` ORDER BY s.id ASC`
	rows, err := db.QueryContext(c, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]webSubject, 0, 32)
	for rows.Next() {
		var item webSubject
		var parent sql.NullInt64
		var description sql.NullString
		var outlineRaw string
		if err := rows.Scan(&item.ID, &item.Name, &parent, &item.Level, &description, &item.CreatedAt, &item.UpdatedAt, &outlineRaw); err != nil {
			return nil, err
		}
		if parent.Valid {
			val := int(parent.Int64)
			item.ParentID = &val
		}
		if description.Valid {
			item.Description = description.String
		}
		item.Outline = subjectOutline{Modules: []outlineModule{}}
		if outlineRaw != "" {
			_ = json.Unmarshal([]byte(outlineRaw), &item.Outline)
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func queryUserSubjects(c *gin.Context, db *sql.DB, userID string) ([]webSubject, error) {
	rows, err := db.QueryContext(
		c,
		`SELECT s.id, s.name, s.parent_subject_id, s.level, s.description, s.created_at, s.updated_at,
		COALESCE(so.outline_json, '')
		FROM user_subjects us
		JOIN subjects s ON s.id = us.subject_id
		LEFT JOIN subject_outlines so ON so.subject_id = s.id
		WHERE us.user_id = ?
		ORDER BY s.id ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]webSubject, 0, 16)
	for rows.Next() {
		var item webSubject
		var parent sql.NullInt64
		var description sql.NullString
		var outlineRaw string
		if err := rows.Scan(&item.ID, &item.Name, &parent, &item.Level, &description, &item.CreatedAt, &item.UpdatedAt, &outlineRaw); err != nil {
			return nil, err
		}
		if parent.Valid {
			val := int(parent.Int64)
			item.ParentID = &val
		}
		if description.Valid {
			item.Description = description.String
		}
		item.Outline = subjectOutline{Modules: []outlineModule{}}
		if outlineRaw != "" {
			_ = json.Unmarshal([]byte(outlineRaw), &item.Outline)
		}
		list = append(list, item)
	}
	return list, rows.Err()
}

func getWebSubjectByID(c *gin.Context, db *sql.DB, id int) (webSubject, error) {
	var item webSubject
	var parent sql.NullInt64
	var description sql.NullString
	var outlineRaw string
	err := db.QueryRowContext(
		c,
		`SELECT s.id, s.name, s.parent_subject_id, s.level, s.description, s.created_at, s.updated_at,
		COALESCE(so.outline_json, '')
		FROM subjects s
		LEFT JOIN subject_outlines so ON so.subject_id = s.id
		WHERE s.id = ?`,
		id,
	).Scan(&item.ID, &item.Name, &parent, &item.Level, &description, &item.CreatedAt, &item.UpdatedAt, &outlineRaw)
	if err != nil {
		return webSubject{}, err
	}
	if parent.Valid {
		val := int(parent.Int64)
		item.ParentID = &val
	}
	if description.Valid {
		item.Description = description.String
	}
	item.Outline = subjectOutline{Modules: []outlineModule{}}
	if outlineRaw != "" {
		_ = json.Unmarshal([]byte(outlineRaw), &item.Outline)
	}
	return item, nil
}

func insertWebSubject(c *gin.Context, db *sql.DB, subject webSubject) (webSubject, error) {
	result, err := db.ExecContext(
		c,
		`INSERT INTO subjects (parent_subject_id, level, name, education_stage, description, created_at, updated_at)
		 VALUES (?, ?, ?, '', ?, NOW(), NOW())`,
		subject.ParentID,
		subject.Level,
		subject.Name,
		subject.Description,
	)
	if err != nil {
		return subject, err
	}
	if insertedID, err := result.LastInsertId(); err == nil {
		subject.ID = int(insertedID)
	}
	outlineRaw, _ := json.Marshal(subject.Outline)
	_, err = db.ExecContext(
		c,
		`INSERT INTO subject_outlines (subject_id, outline_json, updated_at) VALUES (?, ?, NOW())
		 ON DUPLICATE KEY UPDATE outline_json = VALUES(outline_json), updated_at = NOW()`,
		subject.ID,
		string(outlineRaw),
	)
	return subject, err
}

func updateWebSubject(c *gin.Context, db *sql.DB, subject webSubject) error {
	_, err := db.ExecContext(
		c,
		`UPDATE subjects
		 SET parent_subject_id = ?, level = ?, name = ?, description = ?, updated_at = NOW()
		 WHERE id = ?`,
		subject.ParentID,
		subject.Level,
		subject.Name,
		subject.Description,
		subject.ID,
	)
	return err
}

func deleteWebSubject(c *gin.Context, db *sql.DB, id int) error {
	_, _ = db.ExecContext(c, `DELETE FROM subject_outlines WHERE subject_id = ?`, id)
	_, _ = db.ExecContext(c, `DELETE FROM user_subjects WHERE subject_id = ?`, id)
	_, err := db.ExecContext(c, `DELETE FROM subjects WHERE id = ?`, id)
	return err
}

func latestUserID(c *gin.Context, db *sql.DB) (string, error) {
	var id string
	err := db.QueryRowContext(c, `SELECT id FROM users ORDER BY id DESC LIMIT 1`).Scan(&id)
	return id, err
}
