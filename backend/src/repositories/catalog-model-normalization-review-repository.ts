import { db } from "../db/connection";

export interface InsertCatalogModelNormalizationReviewInput {
  import_batch_id: string;
  tenant_id: string;
  row_number: number;
  offer_code: string;
  brand_input: string | null;
  model_input: string | null;
  modification_input: string | null;
  brand_canonical: string | null;
  model_family_canonical: string | null;
  modification_candidate: string | null;
  confidence: number;
  min_confidence_to_apply: number;
  method: string;
  matched_brand_rule_id: string | null;
  matched_model_rule_id: string | null;
  review_reason: "low_confidence";
}

export function insertCatalogModelNormalizationReview(
  input: InsertCatalogModelNormalizationReviewInput,
): void {
  db.prepare(
    `
      INSERT INTO catalog_model_normalization_reviews (
        import_batch_id,
        tenant_id,
        row_number,
        offer_code,
        brand_input,
        model_input,
        modification_input,
        brand_canonical,
        model_family_canonical,
        modification_candidate,
        confidence,
        min_confidence_to_apply,
        method,
        matched_brand_rule_id,
        matched_model_rule_id,
        review_reason
      ) VALUES (
        @import_batch_id,
        @tenant_id,
        @row_number,
        @offer_code,
        @brand_input,
        @model_input,
        @modification_input,
        @brand_canonical,
        @model_family_canonical,
        @modification_candidate,
        @confidence,
        @min_confidence_to_apply,
        @method,
        @matched_brand_rule_id,
        @matched_model_rule_id,
        @review_reason
      )
    `,
  ).run(input);
}
