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
- Add admin/UI workflow for review queue:
  - list pending low-confidence rows,
  - mark reviewed,
  - track acceptance rate by rule.

## Implemented in this iteration
- Added persistent review queue table:
  - `catalog_model_normalization_reviews`
- Queue now receives rows where:
  - rule-based normalization found candidate model family,
  - candidate would change model/modification,
  - normalization was not applied due confidence gate.
- Stored metadata per review item:
  - source values (`brand/model/modification`),
  - candidate normalized values,
  - `confidence`,
  - `min_confidence_to_apply`,
  - matched rule ids.
