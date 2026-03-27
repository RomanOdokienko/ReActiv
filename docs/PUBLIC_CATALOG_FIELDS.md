# Public Catalog Field Set (DEC-03)

Last updated: 2026-03-27
Owner: Codex + project owner

## Purpose
This document defines which catalog fields are intentionally exposed to public users.
It is used as the approval artifact for `DEC-03` and as a guard against accidental data exposure.

## Scope
- Public users in `open` mode (non-authenticated browser clients).
- Endpoints:
  - `GET /api/catalog/items`
  - `GET /api/catalog/items/:id`
  - `GET /api/catalog/filters`
- Admin backoffice routes are out of this scope:
  - `GET /api/admin/catalog/*` (auth-admin, unsanitized payload)

## Policy
- Public responses should contain only fields required for showcase UX and lead routing.
- Operational/internal identifiers and owner-contact style data must be masked for public users.
- Authenticated `admin` and `stock_owner` keep full data access as currently implemented.
- Public query filters for operational fields are ignored for non-authenticated users.

## Public masking rules
### Catalog item payload
For non-admin/non-stock-owner responses:
- `responsiblePerson` -> empty string
- `websiteUrl` -> empty string
- `daysOnSale` -> `null`
- `externalId` -> empty string
- `crmRef` -> empty string

### Catalog filters payload
For non-admin/non-stock-owner responses:
- `responsiblePerson` -> `[]`
- `websiteUrl` -> `[]`
- `externalId` -> `[]`
- `crmRef` -> `[]`
- `yandexDiskUrl` -> `[]`
- `daysOnSaleMin` -> `null`
- `daysOnSaleMax` -> `null`

### Catalog query constraints (public)
For non-admin/non-stock-owner requests to `GET /api/catalog/items`:
- `responsiblePerson` is ignored
- `externalId` is ignored
- `crmRef` is ignored
- `websiteUrl` is ignored
- `yandexDiskUrl` is ignored
- `daysOnSaleMin` is ignored
- `daysOnSaleMax` is ignored

## Rationale (business)
- Keeps public showcase functional (cards, detail pages, gallery flow, pagination/filters).
- Reduces risk of operational leakage and structured enrichment by scrapers.
- Avoids broad contract breakage for current frontend while tightening exposure.

## Next tightening candidates
- Revisit whether `offerCode` should remain public long-term.
- Revisit whether any detail fields can be moved behind authenticated roles after UX review.
