import { db } from "../db/connection";

interface OfferAdminCommentDbRow {
  comment_text: string;
}

interface AppendOfferAdminCommentInput {
  tenantId: string;
  offerCode: string;
  commentText: string;
  createdByUserId: number | null;
}

function normalizeCommentText(rawValue: string): string {
  return rawValue.replace(/\r\n/g, "\n").trim();
}

export function findOfferAdminComments(
  tenantId: string,
  offerCode: string,
): string[] {
  const rows = db
    .prepare(
      `
        SELECT comment_text
        FROM offer_admin_comment_entries
        WHERE tenant_id = ?
          AND offer_code = ?
        ORDER BY created_at DESC, id DESC
      `,
    )
    .all(tenantId, offerCode) as OfferAdminCommentDbRow[];

  return rows
    .map((row) => normalizeCommentText(row.comment_text ?? ""))
    .filter((value) => value.length > 0);
}

export function appendOfferAdminComment(
  input: AppendOfferAdminCommentInput,
): string[] {
  const normalizedComment = normalizeCommentText(input.commentText);
  if (!normalizedComment) {
    return findOfferAdminComments(input.tenantId, input.offerCode);
  }

  db.prepare(
    `
      INSERT INTO offer_admin_comment_entries (
        tenant_id,
        offer_code,
        comment_text,
        created_by_user_id
      ) VALUES (
        @tenant_id,
        @offer_code,
        @comment_text,
        @created_by_user_id
      )
    `,
  ).run({
    tenant_id: input.tenantId,
    offer_code: input.offerCode,
    comment_text: normalizedComment,
    created_by_user_id: input.createdByUserId,
  });

  return findOfferAdminComments(input.tenantId, input.offerCode);
}

export function clearOfferAdminComments(tenantId: string, offerCode: string): void {
  const clearComments = db.transaction(() => {
    db.prepare(
      `
        DELETE FROM offer_admin_comment_entries
        WHERE tenant_id = ?
          AND offer_code = ?
      `,
    ).run(tenantId, offerCode);

    db.prepare(
      `
        DELETE FROM offer_admin_notes
        WHERE tenant_id = ?
          AND offer_code = ?
      `,
    ).run(tenantId, offerCode);
  });

  clearComments();
}
