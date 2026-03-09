import { REQUIRED_IMPORT_FIELDS, type CanonicalField } from "../domain/types";
import { HEADER_ALIASES } from "./header-aliases";
import { normalizeHeader } from "./normalize-header";

export interface ColumnMapResult {
  fieldToColumnIndex: Partial<Record<CanonicalField, number>>;
  missingRequiredFields: CanonicalField[];
}

export function resolveColumnMap(
  headers: unknown[],
  headerAliases: Record<CanonicalField, string[]> = HEADER_ALIASES,
): ColumnMapResult {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const fieldToColumnIndex: Partial<Record<CanonicalField, number>> = {};

  for (const field of REQUIRED_IMPORT_FIELDS) {
    const aliases = headerAliases[field].map((alias) => normalizeHeader(alias));
    const columnIndex = normalizedHeaders.findIndex((header) =>
      aliases.includes(header),
    );

    if (columnIndex >= 0) {
      fieldToColumnIndex[field] = columnIndex;
    }
  }

  const missingRequiredFields = REQUIRED_IMPORT_FIELDS.filter(
    (field) => fieldToColumnIndex[field] === undefined,
  );

  return {
    fieldToColumnIndex,
    missingRequiredFields,
  };
}
