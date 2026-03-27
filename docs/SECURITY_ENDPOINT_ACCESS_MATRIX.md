# Security Endpoint Access Matrix (SEC-00)

Last updated: 2026-03-27
Scope: `backend/src/server.ts` and `backend/src/routes/*`

## Purpose
This document is the implementation-level access matrix for backend endpoints.
It defines which endpoints are public, which require cookie auth, and which require extra role or token checks.

## Global access gate (server-level)
Global auth behavior is defined in `backend/src/server.ts`:
- `ALWAYS_PUBLIC_PATHS`: always public.
- `ALWAYS_PUBLIC_PREFIXES` and `ALWAYS_PUBLIC_DYNAMIC_PREFIXES`: always public path families.
- `OPEN_MODE_PUBLIC_PREFIXES`: public only when platform mode is `open`.
- Any route not matching the public rules requires a valid session cookie and sets `request.authUser`.

## Access classes used below
- `public`: no cookie/session required.
- `public_m2m_token`: no cookie required, but request must provide a valid sync token header.
- `auth_any`: requires authenticated user (any role).
- `auth_admin`: requires authenticated `admin`.
- `auth_admin_or_stock_owner`: requires authenticated `admin` or `stock_owner`.
- `auth_admin_or_activity_viewer`: requires `admin` or login in `ACTIVITY_VIEWER_LOGINS`.

## Endpoint matrix
| Method | Path | Access class | Notes |
|---|---|---|---|
| GET | `/health` | `public` | Liveness endpoint |
| GET | `/` | `public` | Share/SEO route |
| GET | `/landing` | `public` | Share/SEO route |
| GET | `/showcase` | `public` | Share/SEO route |
| GET | `/showcase/:id` | `public` | Share/SEO route |
| GET | `/showcase/:id/preview-image` | `public` | Share/SEO route |
| GET | `/sitemap.xml` | `public` | Sitemap index |
| GET | `/sitemaps/static.xml` | `public` | Dynamic-prefix public route |
| GET | `/sitemaps/items-:chunk.xml` | `public` | Dynamic-prefix public route |
| GET | `/yandex_:code.html` | `public` | Verification route |
| POST | `/api/auth/login` | `public` | Creates cookie session |
| GET | `/api/auth/me` | `auth_any` | Session required |
| POST | `/api/auth/logout` | `auth_any` | Session required, state-changing |
| GET | `/api/platform/mode` | `public` | Platform mode read |
| PATCH | `/api/admin/platform/mode` | `auth_admin` | State-changing |
| GET | `/api/catalog/summary` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/catalog/items` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/catalog/items/:id` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/catalog/filters` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/admin/catalog/summary` | `auth_admin` | Admin-only unsanitized catalog summary |
| GET | `/api/admin/catalog/items` | `auth_admin` | Admin-only unsanitized catalog list |
| GET | `/api/admin/catalog/items/:id` | `auth_admin` | Admin-only unsanitized catalog detail |
| PATCH | `/api/admin/catalog/items/:id/comment` | `auth_admin` | Admin-only lot comment upsert |
| GET | `/api/admin/catalog/filters` | `auth_admin` | Admin-only unsanitized filters metadata |
| GET | `/api/media/card-preview` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/media/preview` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/media/preview-image` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/media/gallery` | `public` in `open`, otherwise `auth_any` | Open-mode public family |
| GET | `/api/favorites/ids` | `auth_any` | User-scoped |
| GET | `/api/favorites` | `auth_any` | User-scoped |
| POST | `/api/favorites/:itemId` | `auth_any` | State-changing |
| DELETE | `/api/favorites/:itemId` | `auth_any` | State-changing |
| GET | `/api/imports` | `auth_admin_or_stock_owner` | Import access guard |
| POST | `/api/imports` | `auth_admin_or_stock_owner` | State-changing |
| DELETE | `/api/imports` | `auth_admin_or_stock_owner` | State-changing |
| GET | `/api/imports/:id` | `auth_admin_or_stock_owner` | Import access guard |
| GET | `/api/admin/users` | `auth_admin` | Admin-only |
| POST | `/api/admin/users` | `auth_admin` | Admin-only, state-changing |
| DELETE | `/api/admin/users/:id` | `auth_admin` | Admin-only, state-changing |
| POST | `/api/admin/users/:id/reset-password` | `auth_admin` | Admin-only, state-changing |
| PATCH | `/api/admin/users/:id/meta` | `auth_admin` | Admin-only, state-changing |
| GET | `/api/admin/catalog/export-min` | `auth_admin` | Admin-only |
| GET | `/api/admin/highlights/card-fillness` | `auth_admin` | Admin-only |
| GET | `/api/admin/highlights/media-health` | `auth_admin` | Admin-only |
| POST | `/api/admin/highlights/media-health/run` | `auth_admin` | Admin-only, state-changing |
| GET | `/api/admin/reso-media/candidates` | `public_m2m_token` | Requires header `x-reso-media-token` = `RESO_MEDIA_SYNC_TOKEN` |
| POST | `/api/admin/reso-media/bulk-update` | `public_m2m_token` | Requires header `x-reso-media-token` = `RESO_MEDIA_SYNC_TOKEN`, state-changing |
| GET | `/api/admin/alpha-media/candidates` | `public_m2m_token` | Requires header `x-reso-media-token` = `ALPHA_MEDIA_SYNC_TOKEN` (fallback to `RESO_MEDIA_SYNC_TOKEN`) |
| POST | `/api/admin/alpha-media/bulk-update` | `public_m2m_token` | Requires header `x-reso-media-token` = `ALPHA_MEDIA_SYNC_TOKEN` (fallback to `RESO_MEDIA_SYNC_TOKEN`), state-changing |
| POST | `/api/public/activity/events` | `public` | Guest activity ingest |
| POST | `/api/activity/events` | `auth_any` | Auth activity ingest, state-changing |
| GET | `/api/admin/activity` | `auth_admin_or_activity_viewer` | Allows `admin` or login in `ACTIVITY_VIEWER_LOGINS` |
| GET | `/api/admin/activity/guests` | `auth_admin_or_activity_viewer` | Allows `admin` or login in `ACTIVITY_VIEWER_LOGINS` |
| GET | `/api/admin/activity/guests/summary` | `auth_admin_or_activity_viewer` | Allows `admin` or login in `ACTIVITY_VIEWER_LOGINS` |

## Explicit exceptions to standard role model
1. `public_m2m_token` endpoints under `/api/admin/reso-media/*` and `/api/admin/alpha-media/*` bypass cookie auth intentionally and rely on sync token header.
2. Activity admin read routes allow a login-based exception (`ACTIVITY_VIEWER_LOGINS`, currently contains `alexey`) in addition to `admin` role.

## Security notes for follow-up tasks
- SEC-01 (CORS): keep `public_m2m_token` endpoints reachable for sync clients while restricting browser origins for credentialed requests.
- SEC-02 (CSRF): apply CSRF to cookie-auth mutating endpoints only; do not apply CSRF requirement to token-based M2M endpoints.
- API-02 (public fields): catalog/media endpoints have mode-dependent public exposure and must keep frontend contract compatibility.
