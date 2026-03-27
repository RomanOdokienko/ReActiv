import { REQUIRED_IMPORT_FIELDS, type CanonicalField } from "../domain/types";
import { HEADER_ALIASES } from "./header-aliases";
import { normalizeHeader } from "./normalize-header";

export interface ColumnMapResult {
  fieldToColumnIndex: Partial<Record<CanonicalField, number>>;
  missingRequiredFields: CanonicalField[];
}

function hasMultipleWords(value: string): boolean {
  return value.split(" ").filter(Boolean).length >= 2;
}

function isHeaderAliasMatch(header: string, alias: string): boolean {
  if (header === alias) {
    return true;
  }

  if (!hasMultipleWords(alias)) {
    return false;
  }

  const normalizedHeader = ` ${header} `;
  const normalizedAlias = ` ${alias} `;
  return normalizedHeader.includes(normalizedAlias);
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
      aliases.some((alias) => isHeaderAliasMatch(header, alias)),
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
