package domain

type UserRole string

const (
	RoleStudent UserRole = "student"
	RoleTeacher UserRole = "teacher"
	RoleAdmin   UserRole = "admin"
)

type Subject struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Code           string `json:"code"`
	EducationStage string `json:"education_stage"`
}

type Conversation struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	SubjectID string `json:"subject_id"`
	UserID    string `json:"user_id"`
}

type Task struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Status    string `json:"status"`
	TraceID   string `json:"trace_id"`
	CreatedAt string `json:"created_at"`
}

type LearningRecord struct {
	UserID         string `json:"user_id"`
	SessionID      string `json:"session_id"`
	Subject        string `json:"subject"`
	Chapter        string `json:"chapter,omitempty"`
	KnowledgePoint string `json:"knowledge_point"`
	Difficulty     string `json:"difficulty,omitempty"`
	AskedAt        string `json:"asked_at,omitempty"`
}
