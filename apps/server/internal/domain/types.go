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

type VideoGenerationRun struct {
	RunID             string `json:"run_id"`
	WorkflowID        string `json:"workflow_id"`
	TraceID           string `json:"trace_id"`
	SessionID         string `json:"session_id"`
	UserID            string `json:"user_id"`
	Subject           string `json:"subject,omitempty"`
	Status            string `json:"status"`
	IntentJSON        string `json:"intent_json,omitempty"`
	ArtifactBundleURL string `json:"artifact_bundle_url,omitempty"`
	ManifestURL       string `json:"manifest_url,omitempty"`
	VideoURL          string `json:"video_url,omitempty"`
	ErrorSummary      string `json:"error_summary,omitempty"`
	CreatedAt         string `json:"created_at"`
	UpdatedAt         string `json:"updated_at"`
}

type LearningRecord struct {
	RecordID       string `json:"record_id,omitempty"`
	UserID         string `json:"user_id"`
	SessionID      string `json:"session_id"`
	Subject        string `json:"subject"`
	Chapter        string `json:"chapter,omitempty"`
	KnowledgePoint string `json:"knowledge_point"`
	Difficulty     string `json:"difficulty,omitempty"`
	AskedAt        string `json:"asked_at,omitempty"`
}
