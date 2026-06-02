package handlers

type webUser struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Phone     string `json:"phone"`
	Avatar    string `json:"avatar,omitempty"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type webSubject struct {
	ID          int            `json:"id"`
	Name        string         `json:"name"`
	Code        int            `json:"code"`
	ParentID    *int           `json:"parentId"`
	Level       int            `json:"level"`
	Description string         `json:"description,omitempty"`
	Outline     subjectOutline `json:"outline"`
	CreatedAt   string         `json:"createdAt"`
	UpdatedAt   string         `json:"updatedAt"`
}

type webUserSubject struct {
	webSubject
	IsOwner bool `json:"isOwner"`
}

type outlineModule struct {
	ID     int            `json:"id"`
	Title  string         `json:"title"`
	Topics []outlineTopic `json:"topics"`
	Order  int            `json:"order"`
}

type outlineTopic struct {
	ID     int            `json:"id"`
	Title  string         `json:"title"`
	Points []outlinePoint `json:"points"`
	Order  int            `json:"order"`
}

type outlinePoint struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
	Order int    `json:"order"`
}

type subjectOutline struct {
	Modules []outlineModule `json:"modules"`
}

type webConversation struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	SubjectID    int    `json:"subjectId"`
	SubjectName  string `json:"subjectName"`
	UserID       string `json:"userId"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
	MessageCount int    `json:"messageCount"`
}

type webMessage struct {
	ID             string                 `json:"id"`
	ConversationID string                 `json:"conversationId"`
	Role           string                 `json:"role"`
	Content        string                 `json:"content"`
	ContentInline  string                 `json:"contentInline,omitempty"`
	ContentRef     string                 `json:"contentRef,omitempty"`
	ContentHash    string                 `json:"contentHash,omitempty"`
	ContentSize    int64                  `json:"contentSize,omitempty"`
	TurnID         string                 `json:"turnId,omitempty"`
	ReplyToID      string                 `json:"replyToMessageId,omitempty"`
	TokenUsage     int                    `json:"tokenUsage,omitempty"`
	Status         string                 `json:"status"`
	CreatedAt      string                 `json:"createdAt"`
	Metadata       interface{}            `json:"metadata,omitempty"`
	Attachments    []webMessageAttachment `json:"attachments,omitempty"`
}

type webMessageAttachment struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	URL          string `json:"url"`
	Type         string `json:"type"`
	Size         int64  `json:"size"`
	MimeType     string `json:"mimeType,omitempty"`
	StorageKey   string `json:"storageKey,omitempty"`
	ThumbnailURL string `json:"thumbnailUrl,omitempty"`
	Hash         string `json:"hash,omitempty"`
	Status       string `json:"status,omitempty"`
}

type webKnowledgeFile struct {
	ID              string `json:"id"`
	KnowledgeBaseID string `json:"knowledgeBaseId"`
	Name            string `json:"name"`
	DisplayName     string `json:"displayName"`
	Type            string `json:"type"`
	URL             string `json:"url"`
	Size            int64  `json:"size"`
	Order           int    `json:"order"`
	Content         string `json:"content,omitempty"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

type webKnowledgeBase struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	SubjectID   int                `json:"subjectId"`
	SubjectName string             `json:"subjectName"`
	Type        string             `json:"type"`
	UserID      string             `json:"userId"`
	Description string             `json:"description,omitempty"`
	Files       []webKnowledgeFile `json:"files"`
	CreatedAt   string             `json:"createdAt"`
	UpdatedAt   string             `json:"updatedAt"`
}

type webAnalytics struct {
	UserID             string           `json:"userId"`
	SubjectID          int              `json:"subjectId"`
	SubjectName        string           `json:"subjectName"`
	WeakPoints         []map[string]any `json:"weakPoints"`
	WordCloud          []map[string]any `json:"wordCloud"`
	Summary            string           `json:"summary,omitempty"`
	SummaryGeneratedAt string           `json:"summaryGeneratedAt,omitempty"`
	UpdatedAt          string           `json:"updatedAt"`
}
