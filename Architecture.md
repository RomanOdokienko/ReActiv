# Lease Platform MVP Architecture

## 1. Goal
Build a local-only MVP where a manager uploads an Excel file with vehicle leasing offers, the system parses Russian headers/values, and shows a clean searchable catalog with filters.

Primary success criterion:
- Upload one `.xlsx` file with the known Russian template.
- Parse and store rows.
- Open catalog and filter offers by core business fields.

## 2. Scope
In scope:
- Local app only (no cloud setup).
- One manual upload flow from browser.
- Parse first non-empty worksheet.
- Map Russian headers to canonical fields (including known typos in source sheet).
- Validate rows and save valid rows to SQLite.
- Show import summary and row-level errors.
- Catalog page with filters, sorting, pagination.

Out of scope:
- Auth and permissions.
- Multi-tenant architecture.
- Background workers/queues.
- External CRM/API sync.
- Advanced deduplication.

## 3. Chosen Stack
Decision:
- Frontend: React + Vite + TypeScript.
- Backend: Node.js + Fastify + TypeScript.
- Excel parsing: `xlsx`.
- Validation: `zod`.
- DB: SQLite + `better-sqlite3`.

Why:
- Fast local setup, low ops overhead, easy deterministic testing for MVP.

## 4. User Flow
1. User opens Upload page.
2. User uploads `.xlsx`.
3. Backend validates file extension/size.
4. Backend detects and normalizes header row (Russian-safe).
5. Backend maps columns and parses each row.
6. Valid rows are inserted into `vehicle_offers`.
7. Invalid rows are written to `import_errors`.
8. Backend returns summary.
9. User opens catalog, applies filters, and reviews offers.

## 5. Canonical Data Model
Entity: `VehicleOffer`
- `id` (autoincrement integer)
- `import_batch_id` (string, required)
- `offer_code` (string, required) <- "Код предложения"
- `status` (string, required) <- "статус"
- `brand` (string, required) <- "марка"
- `model` (string, required) <- "модель"
- `modification` (string, required) <- "модификация"
- `vehicle_type` (string, required) <- "тип ТС"
- `year` (integer, required) <- "Год выпуска"
- `mileage_km` (integer, required) <- "Пробег"
- `key_count` (integer, required) <- "кол-во ключей"
- `pts_type` (string, required) <- "ПТС/ЭПТС"
- `has_encumbrance` (boolean, required) <- "Наличие обременения"
- `is_deregistered` (boolean, required) <- "Снят с учета"
- `responsible_person` (string, required) <- "Ответсвенный за ТС"
- `storage_address` (string, required) <- "Андрес места хранения"
- `days_on_sale` (integer, required) <- "Количество дней реализации"
- `price` (number, required) <- "Стоимость"
- `yandex_disk_url` (string, required) <- "Яндекс Диск"
- `booking_status` (string, required) <- "Статус бронирования"
- `external_id` (string, required) <- "ID"
- `crm_ref` (string, required) <- "CRM"
- `website_url` (string, required) <- "Ссылка на сайт"
- `title` (string, derived): `brand + model + modification` fallback `offer_code`
- `created_at` (datetime)

Entity: `ImportBatch`
- `id` (string)
- `filename` (string)
- `status` (`completed` | `completed_with_errors` | `failed`)
- `total_rows` (int)
- `imported_rows` (int)
- `skipped_rows` (int)
- `created_at` (datetime)

Entity: `ImportError`
- `id` (autoincrement)
- `import_batch_id` (string)
- `row_number` (int)
- `field` (string | null)
- `message` (string)

## 6. Excel Parsing Rules
### 6.1 File constraints
- Accept only `.xlsx`.
- Max size: 10 MB.
- Use first non-empty sheet.

### 6.2 Header normalization (Russian-safe)
For each header:
- Convert to string.
- Unicode normalize (NFKC).
- Trim.
- Lowercase.
- Replace `ё` -> `е`.
- Collapse internal spaces.
- Remove trailing `:` and duplicate punctuation.

### 6.3 Known header aliases
Canonical `offer_code`:
- `код предложения`

Canonical `status`:
- `статус`

Canonical `brand`:
- `марка`

Canonical `model`:
- `модель`

Canonical `modification`:
- `модификация`

Canonical `vehicle_type`:
- `тип тс`
- `типтс`

Canonical `year`:
- `год выпуска`

Canonical `mileage_km`:
- `пробег`

Canonical `key_count`:
- `кол-во ключей`
- `кол во ключей`
- `количество ключей`

Canonical `pts_type`:
- `птс/эптс`
- `птс эптс`

Canonical `has_encumbrance`:
- `наличие обременения`

Canonical `is_deregistered`:
- `снят с учета`

Canonical `responsible_person`:
- `ответсвенный за тс`
- `ответственный за тс`

Canonical `storage_address`:
- `андрес места хранения`
- `адрес места хранения`

Canonical `days_on_sale`:
- `количество дней реализации`

Canonical `price`:
- `стоимость`

Canonical `yandex_disk_url`:
- `яндекс диск`

Canonical `booking_status`:
- `статус бронирования`

Canonical `external_id`:
- `id`

Canonical `crm_ref`:
- `crm`

Canonical `website_url`:
- `ссылка на сайт`

### 6.4 Required fields
Required for row import:
- `offer_code`
- `status`
- `brand`
- `model`
- `modification`
- `vehicle_type`
- `year`
- `mileage_km`
- `key_count`
- `pts_type`
- `has_encumbrance`
- `is_deregistered`
- `responsible_person`
- `storage_address`
- `days_on_sale`
- `price`
- `yandex_disk_url`
- `booking_status`
- `external_id`
- `crm_ref`
- `website_url`

### 6.5 Value normalization
- Strings: trim + collapse spaces.
- Integers (`year`, `mileage_km`, `key_count`, `days_on_sale`): parse int, invalid parse -> row error.
- `year` valid range: 1950..2100, out-of-range -> row error.
- `price`: parse decimal from formats like `1 250 000`, `1,250,000`, `1 250 000 ₽`, invalid parse -> row error.
- Booleans (`has_encumbrance`, `is_deregistered`):
  - true: `да`, `yes`, `true`, `1`
  - false: `нет`, `no`, `false`, `0`
  - else null
- URLs (`yandex_disk_url`, `website_url`): keep as string; invalid URL format -> row error.
- `title`: derived from brand/model/modification.

### 6.6 Row validity
- Row imported only if every required field is present and valid.
- Invalid rows are skipped and logged.

## 7. API Contract
Base path: `/api`.

### 7.1 Upload import
`POST /api/imports`
- multipart form-data, file field: `file`.
- Response:
  - `importBatchId`
  - `status`
  - `summary`: `totalRows`, `importedRows`, `skippedRows`
  - `errors`: first 100 row errors

### 7.2 Import details
`GET /api/imports/:id`
- Returns batch info + row errors.

### 7.3 Catalog list
`GET /api/catalog/items`
Filters:
- `offerCode[]`
- `status[]`
- `brand[]`
- `model[]`
- `modification[]`
- `vehicleType[]`
- `ptsType[]`
- `hasEncumbrance[]`
- `isDeregistered[]`
- `responsiblePerson[]`
- `storageAddress[]`
- `bookingStatus[]`
- `externalId[]`
- `crmRef[]`
- `websiteUrl[]`
- `yandexDiskUrl[]`
- `priceMin`, `priceMax`
- `yearMin`, `yearMax`
- `mileageMin`, `mileageMax`
- `keyCountMin`, `keyCountMax`
- `daysOnSaleMin`, `daysOnSaleMax`
- `search` (all text fields)
- `sortBy` (`created_at`, `price`, `year`, `mileage_km`, `days_on_sale`)
- `sortDir` (`asc`, `desc`)
- `page`, `pageSize`

Response:
- `items[]`
- `pagination`: `page`, `pageSize`, `total`

### 7.4 Filter metadata
`GET /api/catalog/filters`
- distinct values for:
  - `offerCode`
  - `status`
  - `brand`
  - `model`
  - `modification`
  - `vehicleType`
  - `ptsType`
  - `hasEncumbrance`
  - `isDeregistered`
  - `responsiblePerson`
  - `storageAddress`
  - `bookingStatus`
  - `externalId`
  - `crmRef`
  - `websiteUrl`
  - `yandexDiskUrl`
- range values:
  - `priceMin/priceMax`
  - `yearMin/yearMax`
  - `mileageMin/mileageMax`
  - `keyCountMin/keyCountMax`
  - `daysOnSaleMin/daysOnSaleMax`

## 8. Frontend Views
Upload page:
- file input + upload button
- import summary
- row-level error table
- button to open catalog

Catalog page:
- filter sidebar
- search + sort controls
- list/table of offers
- pagination
- empty states for "no data" and "no results"

## 9. SQLite Schema
Tables:
- `import_batches`
- `vehicle_offers`
- `import_errors`

Indexes:
- `vehicle_offers(offer_code)`
- `vehicle_offers(status)`
- `vehicle_offers(brand)`
- `vehicle_offers(model)`
- `vehicle_offers(modification)`
- `vehicle_offers(vehicle_type)`
- `vehicle_offers(pts_type)`
- `vehicle_offers(has_encumbrance)`
- `vehicle_offers(is_deregistered)`
- `vehicle_offers(responsible_person)`
- `vehicle_offers(storage_address)`
- `vehicle_offers(booking_status)`
- `vehicle_offers(external_id)`
- `vehicle_offers(crm_ref)`
- `vehicle_offers(website_url)`
- `vehicle_offers(yandex_disk_url)`
- `vehicle_offers(price)`
- `vehicle_offers(year)`
- `vehicle_offers(mileage_km)`
- `vehicle_offers(key_count)`
- `vehicle_offers(days_on_sale)`
- `vehicle_offers(created_at)`

## 10. Error Handling
- Upload-level: invalid extension, oversize file, parser failure, DB failure.
- Row-level: missing required, invalid conversions.
- Response payload is stable and UI-friendly.

## 11. Logging
- Structured backend logs:
  - import_started
  - import_completed
  - import_failed
- Include `import_batch_id` in all import log entries.

## 12. Security and Limits
- Accept only `.xlsx`.
- Size limit 10 MB.
- Parameterized SQL only.
- Safe text rendering in UI (no raw HTML injection).

## 13. Done Criteria
MVP is complete when:
1. Russian Excel template uploads and imports successfully.
2. Invalid rows are skipped and visible in report.
3. Catalog filtering works for all imported fields.
4. Search/sort/pagination work.
5. App runs fully locally (frontend + backend + sqlite).
