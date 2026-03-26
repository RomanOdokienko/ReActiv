import { db } from "../db/connection";
import type { CatalogListItem } from "./catalog-repository";
import {
  buildStoredPreviewSourceUrl,
  storedMediaFileExists,
} from "../services/local-media-storage";

const LATEST_OFFERS_CTE = `
  WITH latest_offers AS (
    SELECT tenant_id, offer_code, MAX(id) AS offer_id
    FROM vehicle_offers
    GROUP BY tenant_id, offer_code
  )
`;

interface FavoriteCatalogItemDbRow {
  id: number;
  offer_code: string;
  status: string;
  brand: string;
  model: string;
  modification: string;
  title: string;
  year: number | null;
  mileage_km: number | null;
  days_on_sale: number | null;
  price: number | null;
  booking_status: string;
  storage_address: string;
  responsible_person: string;
  card_preview_path: string;
}

interface FavoriteItemIdDbRow {
  item_id: number;
}

interface CountDbRow {
  total: number;
}

export interface OfferIdentity {
  tenantId: string;
  offerCode: string;
}

function mapFavoriteRowToCatalogListItem(row: FavoriteCatalogItemDbRow): CatalogListItem {
  const previewPath = row.card_preview_path.trim();
  const previewUrl =
    previewPath && storedMediaFileExists(previewPath)
      ? buildStoredPreviewSourceUrl(previewPath)
      : null;

  return {
    id: row.id,
    offerCode: row.offer_code,
    status: row.status,
    brand: row.brand,
    model: row.model,
    modification: row.modification,
    title: row.title,
    year: row.year,
    mileageKm: row.mileage_km,
    daysOnSale: row.days_on_sale,
    price: row.price,
    bookingStatus: row.booking_status,
    storageAddress: row.storage_address,
    responsiblePerson: row.responsible_person,
    previewUrl,
  };
}

export function findOfferIdentityByItemId(itemId: number): OfferIdentity | null {
  const row = db
    .prepare(
      `
        SELECT tenant_id, offer_code
        FROM vehicle_offers
        WHERE id = ?
        LIMIT 1
      `,
    )
    .get(itemId) as { tenant_id: string; offer_code: string } | undefined;

  if (!row) {
    return null;
  }

  return {
    tenantId: row.tenant_id,
    offerCode: row.offer_code,
  };
}

export function upsertUserFavorite(
  userId: number,
  identity: OfferIdentity,
): void {
  db.prepare(
    `
      INSERT INTO user_favorites (user_id, tenant_id, offer_code)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, tenant_id, offer_code)
      DO UPDATE SET created_at = CURRENT_TIMESTAMP
    `,
  ).run(userId, identity.tenantId, identity.offerCode);
}

export function deleteUserFavorite(
  userId: number,
  identity: OfferIdentity,
): boolean {
  const result = db
    .prepare(
      `
        DELETE FROM user_favorites
        WHERE user_id = ?
          AND tenant_id = ?
          AND offer_code = ?
      `,
    )
    .run(userId, identity.tenantId, identity.offerCode);

  return result.changes > 0;
}

export function listFavoriteItemIds(userId: number): number[] {
  const rows = db
    .prepare(
      `
        ${LATEST_OFFERS_CTE}
        SELECT lo.offer_id AS item_id
        FROM user_favorites uf
        INNER JOIN latest_offers lo
          ON lo.tenant_id = uf.tenant_id
         AND lo.offer_code = uf.offer_code
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC, uf.id DESC
      `,
    )
    .all(userId) as FavoriteItemIdDbRow[];

  return rows.map((row) => row.item_id);
}

export function listFavoriteCatalogItems(
  userId: number,
  page: number,
  pageSize: number,
): { items: CatalogListItem[]; total: number } {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20;
  const offset = (safePage - 1) * safePageSize;

  const totalRow = db
    .prepare(
      `
        ${LATEST_OFFERS_CTE}
        SELECT COUNT(*) AS total
        FROM user_favorites uf
        INNER JOIN latest_offers lo
          ON lo.tenant_id = uf.tenant_id
         AND lo.offer_code = uf.offer_code
        WHERE uf.user_id = ?
      `,
    )
    .get(userId) as CountDbRow;

  const rows = db
    .prepare(
      `
        ${LATEST_OFFERS_CTE}
        SELECT
          vo.id,
          vo.offer_code,
          vo.status,
          vo.brand,
          vo.model,
          vo.modification,
          vo.title,
          vo.year,
          vo.mileage_km,
          vo.days_on_sale,
          vo.price,
          vo.booking_status,
          vo.storage_address,
          vo.responsible_person,
          vo.card_preview_path
        FROM user_favorites uf
        INNER JOIN latest_offers lo
          ON lo.tenant_id = uf.tenant_id
         AND lo.offer_code = uf.offer_code
        INNER JOIN vehicle_offers vo
          ON vo.id = lo.offer_id
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC, uf.id DESC
        LIMIT ?
        OFFSET ?
      `,
    )
    .all(userId, safePageSize, offset) as FavoriteCatalogItemDbRow[];

  return {
    items: rows.map(mapFavoriteRowToCatalogListItem),
    total: totalRow.total,
  };
}
