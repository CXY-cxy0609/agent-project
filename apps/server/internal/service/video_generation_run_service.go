package service

import (
	"context"
	"encoding/json"

	"tutor-server/internal/domain"
	"tutor-server/internal/repository"
)

type VideoGenerationRunService struct {
	repo repository.VideoGenerationRunRepository
}

func NewVideoGenerationRunService(repo repository.VideoGenerationRunRepository) *VideoGenerationRunService {
	return &VideoGenerationRunService{repo: repo}
}

type UpsertVideoGenerationRunInput struct {
	RunID             string                 `json:"run_id"`
	WorkflowID        string                 `json:"workflow_id"`
	TraceID           string                 `json:"trace_id"`
	SessionID         string                 `json:"session_id"`
	UserID            string                 `json:"user_id"`
	Subject           string                 `json:"subject"`
	Status            string                 `json:"status"`
	IntentJSON        map[string]interface{} `json:"intent_json"`
	ArtifactBundleURL string                 `json:"artifact_bundle_url"`
	ManifestURL       string                 `json:"manifest_url"`
	VideoURL          string                 `json:"video_url"`
	ErrorSummary      string                 `json:"error_summary"`
}

func (s *VideoGenerationRunService) Upsert(
	ctx context.Context,
	input UpsertVideoGenerationRunInput,
) error {
	intentRaw, _ := json.Marshal(input.IntentJSON)
	return s.repo.Upsert(ctx, domain.VideoGenerationRun{
		RunID:             input.RunID,
		WorkflowID:        input.WorkflowID,
		TraceID:           input.TraceID,
		SessionID:         input.SessionID,
		UserID:            input.UserID,
		Subject:           input.Subject,
		Status:            input.Status,
		IntentJSON:        string(intentRaw),
		ArtifactBundleURL: input.ArtifactBundleURL,
		ManifestURL:       input.ManifestURL,
		VideoURL:          input.VideoURL,
		ErrorSummary:      input.ErrorSummary,
	})
}

func (s *VideoGenerationRunService) GetByRunID(
	ctx context.Context,
	runID string,
) (domain.VideoGenerationRun, error) {
	return s.repo.GetByRunID(ctx, runID)
}
