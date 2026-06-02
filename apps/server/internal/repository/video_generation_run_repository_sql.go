package repository

import (
	"context"
	"database/sql"
	"errors"

	"tutor-server/internal/domain"
	"tutor-server/internal/infra/database"
)

type SQLVideoGenerationRunRepository struct {
	db     *sql.DB
	driver string
}

func NewSQLVideoGenerationRunRepository(store *database.Store) *SQLVideoGenerationRunRepository {
	return &SQLVideoGenerationRunRepository{
		db:     store.SQLDB(),
		driver: store.Driver(),
	}
}

func (r *SQLVideoGenerationRunRepository) Upsert(ctx context.Context, run domain.VideoGenerationRun) error {
	query := `INSERT INTO video_generation_runs
		(run_id, workflow_id, trace_id, session_id, user_id, subject, status, intent_json, artifact_bundle_url, manifest_url, video_url, error_summary, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			status = VALUES(status),
			intent_json = VALUES(intent_json),
			artifact_bundle_url = VALUES(artifact_bundle_url),
			manifest_url = VALUES(manifest_url),
			video_url = VALUES(video_url),
			error_summary = VALUES(error_summary),
			updated_at = NOW()`
	args := []any{
		run.RunID,
		run.WorkflowID,
		run.TraceID,
		run.SessionID,
		run.UserID,
		run.Subject,
		run.Status,
		run.IntentJSON,
		run.ArtifactBundleURL,
		run.ManifestURL,
		run.VideoURL,
		run.ErrorSummary,
	}
	if r.driver == "pgx" {
		query = `INSERT INTO video_generation_runs
			(run_id, workflow_id, trace_id, session_id, user_id, subject, status, intent_json, artifact_bundle_url, manifest_url, video_url, error_summary, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
			ON CONFLICT (run_id) DO UPDATE SET
				status = EXCLUDED.status,
				intent_json = EXCLUDED.intent_json,
				artifact_bundle_url = EXCLUDED.artifact_bundle_url,
				manifest_url = EXCLUDED.manifest_url,
				video_url = EXCLUDED.video_url,
				error_summary = EXCLUDED.error_summary,
				updated_at = NOW()`
	}
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *SQLVideoGenerationRunRepository) GetByRunID(
	ctx context.Context,
	runID string,
) (domain.VideoGenerationRun, error) {
	query := `SELECT run_id, workflow_id, trace_id, session_id, user_id, subject, status, intent_json, artifact_bundle_url, manifest_url, video_url, error_summary, created_at, updated_at
		FROM video_generation_runs
		WHERE run_id = ?`
	args := []any{runID}
	if r.driver == "pgx" {
		query = `SELECT run_id, workflow_id, trace_id, session_id, user_id, subject, status, intent_json, artifact_bundle_url, manifest_url, video_url, error_summary, created_at, updated_at
			FROM video_generation_runs
			WHERE run_id = $1`
	}
	var run domain.VideoGenerationRun
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&run.RunID,
		&run.WorkflowID,
		&run.TraceID,
		&run.SessionID,
		&run.UserID,
		&run.Subject,
		&run.Status,
		&run.IntentJSON,
		&run.ArtifactBundleURL,
		&run.ManifestURL,
		&run.VideoURL,
		&run.ErrorSummary,
		&run.CreatedAt,
		&run.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.VideoGenerationRun{}, ErrNotFound
		}
		return domain.VideoGenerationRun{}, err
	}
	return run, nil
}
