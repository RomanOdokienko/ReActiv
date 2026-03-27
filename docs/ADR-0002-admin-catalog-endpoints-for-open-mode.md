# ADR-0002: Separate Admin Catalog Endpoints In Open Mode

## Status

Accepted

## Context

In platform `open` mode, `GET /api/catalog/*` routes are intentionally public.
At server pre-handler level these paths are allowed before auth session resolution.
As a result, even logged-in admins can receive public-sanitized payloads on these routes.

This causes admin UI regressions for operational fields:
- `responsiblePerson`
- `daysOnSale`
- related internal filters

## Decision

Keep public catalog endpoints unchanged for showcase safety, and introduce dedicated admin endpoints:

- `GET /api/admin/catalog/summary`
- `GET /api/admin/catalog/items`
- `GET /api/admin/catalog/items/:id`
- `GET /api/admin/catalog/filters`

Rules:
- admin endpoints require authenticated `admin` role;
- admin endpoints return full (unsanitized) catalog payloads;
- admin frontend pages use `/api/admin/catalog/*`;
- public showcase continues using `/api/catalog/*`.

## Consequences

### Positive

- Admin always sees full catalog fields in both `open` and `closed` platform modes.
- Public data masking policy remains intact.
- Endpoint responsibility becomes explicit: public vs backoffice.

### Negative

- API surface increases (two endpoint families).
- Frontend must choose endpoint family by context.

## Follow-up

- If needed, introduce shared internal service for catalog route policies
  to avoid drift between public and admin route handlers.
