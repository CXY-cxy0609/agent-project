package handlers

import (
	"sort"
	"strings"
	"sync"
	"time"
)

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
	ID             string      `json:"id"`
	ConversationID string      `json:"conversationId"`
	Role           string      `json:"role"`
	Content        string      `json:"content"`
	Status         string      `json:"status"`
	CreatedAt      string      `json:"createdAt"`
	Metadata       interface{} `json:"metadata,omitempty"`
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

type webState struct {
	mu sync.RWMutex

	nextSubjectID int
	users         map[string]webUser
	subjects      map[int]webSubject
	conversations map[string]webConversation
	messages      map[string][]webMessage
	knowledge     map[string]webKnowledgeBase
	analytics     map[int]webAnalytics
}

var state = newWebState()

func newWebState() *webState {
	now := time.Now().UTC().Format(time.RFC3339)
	s := &webState{
		nextSubjectID: 104,
		users: map[string]webUser{
			"mock-user-001": {
				ID: "mock-user-001", Username: "测试同学", Phone: "13800138000", Role: "student", CreatedAt: now, UpdatedAt: now,
			},
		},
		subjects: map[int]webSubject{
			101: {ID: 101, Name: "高等数学", Code: 1001, Level: 1, Description: "理工科考研必备", Outline: subjectOutline{Modules: []outlineModule{}}, CreatedAt: now, UpdatedAt: now},
			102: {ID: 102, Name: "线性代数", Code: 1002, Level: 1, Description: "矩阵和向量空间", Outline: subjectOutline{Modules: []outlineModule{}}, CreatedAt: now, UpdatedAt: now},
			103: {ID: 103, Name: "英语", Code: 2001, Level: 1, Description: "考研英语能力提升", Outline: subjectOutline{Modules: []outlineModule{}}, CreatedAt: now, UpdatedAt: now},
		},
		conversations: map[string]webConversation{},
		messages:      map[string][]webMessage{},
		knowledge:     map[string]webKnowledgeBase{},
		analytics:     map[int]webAnalytics{},
	}

	s.analytics[101] = webAnalytics{
		UserID:      "mock-user-001",
		SubjectID:   101,
		SubjectName: "高等数学",
		WeakPoints: []map[string]any{
			{"id": "wp-001", "keyword": "洛必达法则", "level": "high", "count": 8, "relatedChapter": "函数与极限"},
			{"id": "wp-002", "keyword": "广义积分收敛", "level": "high", "count": 6, "relatedChapter": "积分学"},
		},
		WordCloud: []map[string]any{
			{"text": "极限", "weight": 90, "level": "high"},
			{"text": "积分", "weight": 85, "level": "high"},
		},
		Summary:            "建议优先补齐极限与积分核心题型。",
		SummaryGeneratedAt: now,
		UpdatedAt:          now,
	}
	return s
}

func listSubjectsSorted(subjects map[int]webSubject) []webSubject {
	list := make([]webSubject, 0, len(subjects))
	for _, item := range subjects {
		list = append(list, item)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Code == list[j].Code {
			return list[i].ID < list[j].ID
		}
		return list[i].Code < list[j].Code
	})
	return list
}

func subjectNameByID(subjects map[int]webSubject, id int) string {
	if subject, ok := subjects[id]; ok {
		return subject.Name
	}
	return "未知学科"
}

func filterIncludes(text, keyword string) bool {
	if keyword == "" {
		return true
	}
	return strings.Contains(strings.ToLower(text), strings.ToLower(keyword))
}
