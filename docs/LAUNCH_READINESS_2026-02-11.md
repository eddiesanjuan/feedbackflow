# Launch Readiness Audit - 2026-02-11

Scope: execute the three launch tasks from the latest feedback report.

## 1) Direct Download Link Verification

Status: PASS

Actions completed:
- Updated landing page primary CTA to a true direct download URL:
  - `https://github.com/eddiesanjuan/markupr/releases/download/v0.4.0/FeedbackFlow-0.4.0-arm64.dmg`
- Verified the direct URL returns HTTP 200.
- Verified GitHub repo and release links return HTTP 200.

Files touched:
- `site/index.html`

## 2) GitHub Launch Audit

Status: PASS with noted follow-ups

Checked:
- Repository visibility + default branch: public, `main`.
- Core docs present: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`.
- CI health: most recent `CI` runs on `main` are passing.
- Open PR queue: only three Dependabot PRs are open.
- Secret pattern scan in tracked code: no obvious leaked API keys found.

Important follow-ups (non-blocking for landing page, blocking for polished release ops):
- Historical release workflow runs (`v0.1.0`, `v0.4.0`) show `Create Release` permission failure (`Resource not accessible by integration`).
- Latest published release assets still use legacy filenames (`FeedbackFlow-...`) even though project branding is now markupr.

## 3) Launch Checklist Execution

Status: EXECUTED

Checklist run:
- [x] Landing server smoke test from repo root (`npm start`) returns HTTP 200.
- [x] `site/server.js` standalone smoke test returns HTTP 200.
- [x] Desktop code quality gates pass locally:
  - [x] `npm run typecheck`
  - [x] `npm run test:unit -- --run` (262/262)
  - [x] `npm run build`
- [x] Landing deployment workflow aligned to current source directory (`site/` instead of stale `docs/landing/`).

Files touched:
- `.github/workflows/deploy-landing.yml`

## Go/No-Go

- Railway landing page deploy tomorrow: GO.
- Desktop public release operations: GO with follow-up to normalize release artifact naming + ensure release workflow token permissions are correct before next tagged release.
