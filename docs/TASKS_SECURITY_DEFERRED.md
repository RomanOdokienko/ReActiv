# Deferred Security Backlog (Business-Gated)

Last updated: 2026-03-25
Owner: Codex + project owner

This file stores security tasks that are valid and important, but intentionally postponed until business confirmation of platform direction.

## Deferred tasks
| ID | Priority | Status | Task | Reason deferred | Re-open trigger |
|---|---|---|---|---|---|
| SEC-05 | P0 | deferred | Enable baseline security headers on frontend host (`reactiv.pro`) | Requires infrastructure migration (Docker/Caddy or edge proxy setup) and adds operational overhead for MVP stage | Platform confirmed business-wise, and we approve infra hardening wave |

## SEC-05 notes
- Context:
  - Timeweb support confirmed that frontend Apps currently cannot set custom response headers via panel.
  - Without Docker deployment (or external edge proxy), frontend cannot emit HSTS/CSP/XFO/XCTO/Referrer-Policy/Permissions-Policy.
- Target artifact:
  - `docs/FRONTEND_SECURITY_HEADERS_ROLLOUT.md`
  - `scripts/check-frontend-security-headers.ps1`
- Acceptance check:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/check-frontend-security-headers.ps1`
  - expected result: `PASSED` for `reactiv.pro` and `www.reactiv.pro`.
