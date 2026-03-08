# Architecture Guardrails

These are hard rules for MVP and early scale. Do not violate them without explicit ADR.

## Core Invariants

1. Data isolation is mandatory: every business entity belongs to one `tenant`.
2. Offer identity is composite: unique key is `tenant_id + offer_code`.
3. Weekly import is snapshot-based:
   - compare current snapshot with previous snapshot for the same tenant,
   - compute `added`, `removed`, `unchanged` by `offer_code` only.
4. Import history is immutable:
   - new imports never erase historical batches/snapshots.
5. Critical validation blocks row import:
   - missing `offer_code`,
   - missing `brand`,
   - duplicate `offer_code` inside one file.
6. Soft validation does not block import:
   - row is imported,
   - invalid field is normalized to `null`,
   - warning is stored.

## Change Safety Rules

Use expand-switch-cleanup for all risky changes:

1. Expand:
   - add new schema/code paths,
   - keep old path working.
2. Switch:
   - move reads/writes to new path,
   - verify metrics and behavior.
3. Cleanup:
   - remove old path only after stable verification.

## Release Guardrails

1. Small commits only.
2. No destructive migrations in one step.
3. DB changes must be backward compatible first.
4. Build must pass for backend and frontend before merge.
5. Unrelated local changes must stay untouched.

## Trigger For ADR

Create ADR before implementation if change affects:

- identity keys,
- import semantics,
- access control model,
- storage backend,
- data retention policy.
