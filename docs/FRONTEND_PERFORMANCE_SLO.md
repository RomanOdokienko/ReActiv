# Frontend Performance SLO (DEC-04)

Date: 2026-03-25  
Decision ID: `DEC-04`  
Scope: `reactiv.pro` public pages (`/`, `/landing`, `/showcase/:id`)

## Why this decision exists
- Keep performance work measurable and business-oriented.
- Protect conversion and SEO while we continue security hardening.
- Avoid over-engineering at MVP stage: focus on 3 metrics that matter now.

## SLO targets for current stage
| Metric | Target (green) | Warning (yellow) | Risk (red) |
|---|---|---|---|
| LCP (mobile, p75) | <= 2.8s | > 2.8s and <= 3.2s | > 3.2s |
| CLS (mobile, p75) | <= 0.10 | > 0.10 and <= 0.15 | > 0.15 |
| TBT (mobile lab, median of 3 runs) | <= 250ms | > 250ms and <= 350ms | > 350ms |

Notes:
- LCP/CLS are tracked as field metrics (p75) where available.
- TBT is a lab guardrail for release control because it reacts quickly to script load regressions.

## Measurement policy (lightweight, MVP-safe)
1. Before release:
   - run frontend build,
   - run Lighthouse for `/` and one representative `/showcase/:id` page (mobile profile, 3 runs each),
   - compare with previous baseline.
2. Weekly check:
   - validate LCP/CLS trend from available analytics/CrUX data.
3. Escalation:
   - any red metric blocks further performance-sensitive changes until mitigated or explicitly accepted.

## Operational rollback guidance
- First rollback lever for regressions from 3rd-party scripts:
  - disable or delay chat autoload (`JIVO_*` runtime config),
  - keep analytics on deferred loading path.
- If impact remains, revert latest `PERF-02` step.

## Out of scope for current stage
- Full automated RUM pipeline for all routes.
- Strict per-device SLO segmentation.
- Advanced anti-bot/perf orchestration at edge.

