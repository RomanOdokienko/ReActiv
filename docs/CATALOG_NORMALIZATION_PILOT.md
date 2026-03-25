# Catalog Normalization Pilot (BMW / SHACMAN / KAMAZ)

Last updated: 2026-03-25
Owner: Codex + project owner

## Scope
- Pilot normalizes only model families for:
  - `BMW`
  - `SHACMAN`
  - `KAMAZ`
- Import stays backward-compatible:
  - raw source values still come from the same file columns,
  - normalization can be disabled by env flag.

## Behavior
- Enabled in import pipeline via:
  - `CATALOG_MODEL_NORMALIZATION_ENABLED=true`
- Confidence gate:
  - `CATALOG_MODEL_NORMALIZATION_MIN_CONFIDENCE` (default `0.75`)
- If confidence is below threshold, row keeps original model/modification.

## Current rule strategy
- Rule-based matching on normalized/transliterated text.
- For BMW:
  - merges variants like `530d`, `G30`, `5 series` into family `5`.
- For SHACMAN:
  - maps `X3000/F3000/M3000/L3000` and key `SX*` aliases.
- For KAMAZ:
  - maps known index families (`5490`, `54901`, `65115`, etc.).

## Data safety
- No identity changes:
  - `tenant_id + offer_code` is untouched.
- No import contract changes:
  - blocking validation remains the same.
- Rollback:
  - set `CATALOG_MODEL_NORMALIZATION_ENABLED=false`.

## Next iteration
- Add storage for normalization metadata:
  - method,
  - confidence,
  - rule id,
  - review queue for low-confidence rows.
