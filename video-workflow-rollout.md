# Video Workflow Rollout Checklist

## Scope

This checklist covers production rollout for the enterprise video workflow upgrade:

- run artifact directory and manifest
- image semantic extraction before routing
- optional video subgraph execution from QA route
- COS archival bundle upload
- DB persistence of run index (`video_generation_runs`)

## Phase 0: Config Readiness

- Set `INTERNAL_TOKEN` in both `apps/server` and `apps/agent`.
- Ensure `SERVER_URL` in `apps/agent` points to server API host.
- Ensure `STORAGE_SERVICE_URL` supports non-mp4 file uploads (`.json`, `.tar.gz`).
- Ensure agent runtime can write `apps/manim-project/.temp-project`.

## Phase 1: Staging Verification

- Run one `video_request` case and verify files exist:
  - `intent-classification.json`
  - `storyboard.json`
  - `scripts/script-v*.py`
  - `render/render-attempt-*.json`
  - `result.json`
  - `manifest.json`
- Verify `run-bundle.tar.gz` upload succeeds and URL is returned.
- Verify `video_generation_runs` has row with `video_url`, `artifact_bundle_url`, `manifest_url`.
- Verify QA path without explicit video request does not trigger video subgraph.
- Verify QA path with `generateVideo=true` triggers video subgraph.

## Phase 2: Production Guardrails

- Enable runtime alerting for:
  - video run persist failure (`/api/video-runs`)
  - archive upload failure
  - render retry exhaustion
- Add dashboard metrics:
  - total runs / success rate
  - mean render latency
  - mean upload latency
  - archive upload failure rate
- Enforce local artifact retention policy (daily cleanup job).

## Rollback Plan

- Disable video archival by unsetting `STORAGE_SERVICE_URL` or feature flagging archive branch.
- Keep video generation main path active (video URL upload remains independent).
- If semantic extraction quality drops:
  - fallback to original `userMessage` only
  - keep routing logic operational.
- DB rollback:
  - preserve table `video_generation_runs`
  - stop writes by disabling internal endpoint registration if needed.

## Operational Notes

- `video_generation_runs` stores index data only, not heavy artifacts.
- Full troubleshooting payload lives in COS bundle.
- If internal token is missing, run persistence degrades gracefully and does not block user response.
