import { db } from "../db/connection";

interface OfferAdminNoteDbRow {
  comment_text: string;
}

interface UpsertOfferAdminNoteInput {
  tenantId: string;
  offerCode: string;
  commentText: string;
  updatedByUserId: number | null;
}

function normalizeCommentText(rawValue: string): string {
  return rawValue.replace(/\r\n/g, "\n").trim();
}

export function findOfferAdminComment(
  tenantId: string,
  offerCode: string,
): string | null {
  const row = db
    .prepare(
      `
        SELECT comment_text
        FROM offer_admin_notes
        WHERE tenant_id = ?
          AND offer_code = ?
        LIMIT 1
      `,
    )
    .get(tenantId, offerCode) as OfferAdminNoteDbRow | undefined;

  if (!row) {
    return null;
  }

  const normalized = normalizeCommentText(row.comment_text ?? "");
  return normalized || null;
}

export function upsertOfferAdminComment(
  input: UpsertOfferAdminNoteInput,
): string {
  const normalizedComment = normalizeCommentText(input.commentText);

  if (!normalizedComment) {
    db.prepare(
      `
        DELETE FROM offer_admin_notes
        WHERE tenant_id = ?
          AND offer_code = ?
      `,
    ).run(input.tenantId, input.offerCode);
    return "";
  }

  db.prepare(
    `
      INSERT INTO offer_admin_notes (
        tenant_id,
        offer_code,
        comment_text,
        updated_by_user_id
      ) VALUES (
        @tenant_id,
        @offer_code,
        @comment_text,
        @updated_by_user_id
      )
      ON CONFLICT(tenant_id, offer_code) DO UPDATE SET
        comment_text = excluded.comment_text,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run({
    tenant_id: input.tenantId,
    offer_code: input.offerCode,
    comment_text: normalizedComment,
    updated_by_user_id: input.updatedByUserId,
  });

  return normalizedComment;
}
