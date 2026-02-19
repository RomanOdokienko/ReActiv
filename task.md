# Lease Platform MVP - Granular Task Plan

This plan uses `Architecture.md` and is designed for one-task-at-a-time execution with testing between every step.

## Strict Execution Protocol
1. Read `Architecture.md` and this file before starting.
2. Execute exactly one task.
3. Stop after that task.
4. Wait for user testing.
5. If test passes: commit only that task.
6. Move to the next task.
7. No unrelated edits and no broad refactors.

## Global Coding Rules
- Absolute minimum code for current task only.
- Keep changes modular and testable.
- Do not break existing behavior.
- If manual action is required, state it clearly.
- Local-only runtime (no Supabase/AWS).

## Task List

### Phase 0 - Bootstrap

**T001 - Create base folders**
- Start: repository has no app folders.
- Do: create `backend/` and `frontend/`.
- End: both folders exist.
- Test: directory listing confirms both.

**T002 - Init backend Node project**
- Start: `backend/` exists without `package.json`.
- Do: initialize `backend/package.json`.
- End: backend npm project exists.
- Test: `npm run` works in `backend`.

**T003 - Scaffold frontend app**
- Start: `frontend/` exists without Vite app.
- Do: scaffold React + TypeScript app in `frontend/`.
- End: app files generated.
- Test: `npm run build` succeeds in `frontend`.

**T004 - Add minimal root README**
- Start: no run documentation.
- Do: create `README.md` with local run steps.
- End: clear backend/frontend commands exist.
- Test: follow commands successfully.

### Phase 1 - Backend Foundation

**T005 - Add backend runtime deps**
- Start: dependencies not installed.
- Do: add `fastify`, `@fastify/multipart`, `zod`, `xlsx`, `better-sqlite3`.
- End: deps listed in backend manifest.
- Test: `npm install` completes.

**T006 - Add backend dev deps**
- Start: TS tooling missing.
- Do: add `typescript`, `tsx`, `@types/node`.
- End: dev deps listed.
- Test: `npx tsc --noEmit` runs.

**T007 - Add backend tsconfig**
- Start: missing TS config.
- Do: create `backend/tsconfig.json`.
- End: TS compiler can parse backend source.
- Test: `npm run typecheck` runs (or expected initial errors only).

**T008 - Add backend npm scripts**
- Start: no scripts for dev/build/typecheck/start.
- Do: add scripts to backend `package.json`.
- End: scripts available.
- Test: run `npm run typecheck`.

**T009 - Add Fastify server entry**
- Start: no server source.
- Do: create `backend/src/server.ts` with `/health`.
- End: server starts successfully.
- Test: `GET /health` returns 200.

### Phase 2 - DB Schema

**T010 - Add SQLite connection module**
- Start: no DB connection file.
- Do: create `backend/src/db/connection.ts`.
- End: app opens local SQLite DB.
- Test: server boots without DB errors.

**T011 - Create import tables**
- Start: DB has no import tables.
- Do: create `import_batches` and `import_errors`.
- End: both tables auto-created on startup.
- Test: inspect SQLite schema.

**T012 - Create `vehicle_offers` table**
- Start: no offers table.
- Do: add schema for all canonical columns from `Architecture.md`.
- End: table exists with required columns.
- Test: inspect table schema.

**T013 - Add DB indexes**
- Start: no performance indexes.
- Do: add indexes for offer code, status, brand, vehicle type, booking status, price, year, created_at.
- End: indexes created idempotently.
- Test: inspect SQLite index list.

### Phase 3 - Import Mapping (Russian Template)

**T014 - Define domain types**
- Start: no shared types for offers/imports/errors.
- Do: add TypeScript interfaces/types.
- End: types exported and compilable.
- Test: `npm run typecheck`.

**T015 - Add Russian header alias dictionary**
- Start: no mapping dictionary.
- Do: add canonical-field map with Russian headers and known typo variants.
- End: mapper supports listed headers from template.
- Test: alias lookup resolves sample headers.

**T016 - Add Unicode-safe header normalization**
- Start: raw header text is not normalized.
- Do: implement normalize helper: NFKC, lowercase, trim, collapse spaces, `ё`->`е`.
- End: deterministic normalized header output.
- Test: helper handles Russian text variants.

**T017 - Implement header-to-field resolver**
- Start: no mapping resolver.
- Do: map worksheet headers to canonical fields, report missing required fields.
- End: resolver returns mapping + missing list.
- Test: provided template headers map correctly.

### Phase 4 - Value Parsing and Row Validation

**T018 - Add generic string cleaner**
- Start: no string cleanup utility.
- Do: trim/collapse whitespace helper.
- End: normalized string output.
- Test: dirty samples become clean.

**T019 - Add integer parser**
- Start: no integer parser utility.
- Do: parse int values for year/mileage/key_count/days_on_sale.
- End: valid int or null.
- Test: numeric and non-numeric samples.

**T020 - Add price parser**
- Start: no robust decimal parser.
- Do: parse price with spaces, commas, ruble symbols.
- End: valid number or null.
- Test: examples like `1 250 000`, `1,250,000`, `1 250 000 ₽`.

**T021 - Add boolean parser for RU/EN labels**
- Start: no bool parser.
- Do: parse values like `да/нет`, `yes/no`, `1/0`.
- End: `true|false|null`.
- Test: representative cases.

**T022 - Add URL sanitizer/parser helper**
- Start: url fields stored raw.
- Do: minimal normalization for url strings and warning support.
- End: normalized url string or null.
- Test: valid and invalid URL samples.

**T023 - Implement row normalizer**
- Start: helpers exist but row-to-domain conversion missing.
- Do: map one Excel row into canonical `VehicleOffer` candidate with all template fields.
- End: normalizer returns normalized object.
- Test: one sample row maps correctly.

**T024 - Implement required field validation**
- Start: no required-field enforcement.
- Do: validate that all template fields are present and valid (`offer_code`, `status`, `brand`, `model`, `modification`, `vehicle_type`, `year`, `mileage_km`, `key_count`, `pts_type`, `has_encumbrance`, `is_deregistered`, `responsible_person`, `storage_address`, `days_on_sale`, `price`, `yandex_disk_url`, `booking_status`, `external_id`, `crm_ref`, `website_url`).
- End: invalid rows produce structured errors.
- Test: missing required values fail as expected.

**T025 - Implement title builder**
- Start: `title` derivation missing.
- Do: build `title = brand + model + modification`, fallback `offer_code`.
- End: every saved row has non-empty title.
- Test: row without brand/model falls back correctly.

### Phase 5 - Repositories

**T026 - Add import batch repository**
- Start: no persistence methods for batches.
- Do: create methods create/update/get.
- End: batch lifecycle can be persisted.
- Test: insert/update/read roundtrip.

**T027 - Add vehicle offer repository insert**
- Start: no offer insert method.
- Do: add insert method for normalized offers.
- End: valid offers are stored.
- Test: inserted row appears in DB.

**T028 - Add import error repository insert**
- Start: no error persistence method.
- Do: add insert method for row errors.
- End: errors are stored per batch.
- Test: inserted error row appears in DB.

### Phase 6 - Import Service and Routes

**T029 - Implement Excel reader service**
- Start: no workbook reader.
- Do: read `.xlsx`, pick first non-empty sheet, return headers+rows.
- End: service returns structured data for parser.
- Test: sample file row count is correct.

**T030 - Implement import orchestrator**
- Start: no end-to-end import use case.
- Do: batch create -> map headers -> parse rows -> validate -> persist -> summary.
- End: orchestrator returns deterministic summary.
- Test: DB counts match summary.

**T031 - Register multipart plugin**
- Start: API cannot receive file uploads.
- Do: register `@fastify/multipart`.
- End: server accepts multipart requests.
- Test: endpoint no longer rejects multipart.

**T032 - Implement `POST /api/imports`**
- Start: no upload endpoint.
- Do: add route with `.xlsx` and size checks, call orchestrator.
- End: returns batch id, status, summary, errors.
- Test: upload returns expected response.

**T033 - Implement `GET /api/imports/:id`**
- Start: no batch details endpoint.
- Do: return batch metadata and errors.
- End: endpoint available for UI details.
- Test: request with known id returns expected body.

### Phase 7 - Catalog API

**T034 - Add catalog query schema**
- Start: query params unvalidated.
- Do: add Zod schema for filters on all imported fields plus search/sort/pagination/ranges.
- End: invalid queries return 400.
- Test: valid and invalid requests.

**T035 - Implement filtered catalog SQL**
- Start: no filtered list query.
- Do: build parameterized SQL with filters for all imported fields, sort, page.
- End: returns list + total count.
- Test: seeded DB queries return expected subsets.

**T036 - Implement `GET /api/catalog/items`**
- Start: no items endpoint.
- Do: route uses query schema + repository query.
- End: response includes `items` and `pagination`.
- Test: endpoint works with and without filters.

**T037 - Implement filter metadata query**
- Start: no options endpoint data source.
- Do: fetch distinct values for all filterable text/boolean fields and ranges for all numeric fields.
- End: metadata object available.
- Test: metadata reflects DB content.

**T038 - Implement `GET /api/catalog/filters`**
- Start: no metadata endpoint.
- Do: expose filter metadata via API.
- End: frontend can load filter values.
- Test: endpoint returns expected keys.

### Phase 8 - Frontend Foundation

**T039 - Add frontend deps for routing and API calls**
- Start: app has base scaffold only.
- Do: add minimum required dependencies.
- End: frontend build still passes.
- Test: `npm run build`.

**T040 - Create API client module**
- Start: no shared API layer.
- Do: add typed requests for imports and catalog.
- End: UI can call backend through one client.
- Test: TypeScript compile passes.

**T041 - Add routes and base layout**
- Start: no app routes for flow.
- Do: add Upload and Catalog routes.
- End: both pages render.
- Test: navigate to both URLs.

### Phase 9 - Upload UI

**T042 - Build upload form**
- Start: upload page has no functional form.
- Do: add file input and submit button.
- End: file can be selected and submitted.
- Test: selected filename shown in UI.

**T043 - Connect upload API call**
- Start: form not wired to backend.
- Do: call `POST /api/imports` with multipart.
- End: summary is shown after upload.
- Test: successful upload renders counts.

**T044 - Render import errors table**
- Start: row errors not visible in UI.
- Do: show row number, field, message list.
- End: user can inspect skipped rows.
- Test: invalid rows appear in table.

### Phase 10 - Catalog UI

**T045 - Render catalog list**
- Start: catalog page has no data list.
- Do: fetch and render offers table/list.
- End: imported offers are displayed.
- Test: after import, rows visible.

**T046 - Build filter controls**
- Start: no filter widgets.
- Do: add controls for all imported fields (text/multiselect/boolean/range as appropriate).
- End: controls manage local state.
- Test: changing controls updates state.

**T047 - Connect filters to API**
- Start: controls not wired to backend.
- Do: send filter params to `/api/catalog/items`.
- End: list updates to filtered results.
- Test: filter selection reduces/changes results.

**T048 - Add search + sorting + pagination**
- Start: missing list control UX.
- Do: add search input, sort controls, pager.
- End: query state drives list API.
- Test: search, sort, next page each change results.

**T049 - Add explicit empty states**
- Start: empty result UX unclear.
- Do: render states for "no imported data" and "no results for filters".
- End: clear UX messages shown.
- Test: verify both states manually.

### Phase 11 - Hardening and Handover

**T050 - Add import structured logs**
- Start: import flow has limited observability.
- Do: log `import_started/completed/failed` with `import_batch_id`.
- End: logs support diagnostics.
- Test: run import and inspect logs.

**T051 - Add final smoke-check section to README**
- Start: no compact manual verification checklist.
- Do: document upload+catalog smoke flow.
- End: reproducible local test checklist exists.
- Test: run checklist end-to-end.

## Completion Definition
MVP completion = tasks `T001..T051` completed sequentially with:
- user testing after each task,
- one commit per passed task,
- no bundled multi-task commits.
