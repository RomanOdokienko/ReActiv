# Import Contract (MVP)

This document fixes import semantics so behavior does not drift over time.

## Scope

- Input: tenant-specific Excel file.
- Output: current tenant showcase snapshot + immutable import history.

## Identity

- Canonical offer key is `offer_code`.
- Platform uniqueness is `tenant_id + offer_code`.
- `offer_code` normalization:
  - trim spaces,
  - if numeric and shorter than 6 chars -> left-pad with zeroes.

## Validation

### Critical (row is skipped)

1. `offer_code` is empty.
2. `brand` is empty.
3. duplicate `offer_code` in same file.

### Non-critical (row is imported with warning)

- Invalid optional fields are normalized to `null`.
- Warning is written to import errors.

## Delta Semantics

Delta is computed by `offer_code` only, inside one tenant:

- `added`: code exists in current snapshot but not in previous snapshot.
- `removed`: code exists in previous snapshot but not in current snapshot.
- `unchanged`: code exists in both snapshots.
- `updated`: not used in MVP business interpretation.

## Business Labels

- `added` = new arrivals.
- `removed` = sold/withdrawn (for MVP interpretation).
- `skipped` = invalid rows (critical validation failed).

## Public Showcase Filter: New This Week

- Count source: latest successful import `added_rows`.
- Filter source: codes present in latest snapshot and absent in previous snapshot.

## Non-goals (MVP)

- No field-level lifecycle analytics per offer.
- No cross-tenant mixed deltas.
- No hard delete of historical import batches.
