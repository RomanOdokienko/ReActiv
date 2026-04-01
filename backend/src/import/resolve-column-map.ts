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

function getHeaderAliasMatchScore(
  header: string,
  alias: string,
  aliasPriority: number,
): number {
  if (header === alias) {
    // For exact matches prioritize alias order, not alias length.
    return 100_000 + aliasPriority;
  }

  if (!hasMultipleWords(alias)) {
    return 0;
  }

  const normalizedHeader = ` ${header} `;
  const normalizedAlias = ` ${alias} `;
  if (normalizedHeader.includes(normalizedAlias)) {
    // For partial multi-word matches keep specificity by alias length.
    return 50_000 + alias.length * 10 + aliasPriority;
  }

  return 0;
}

function getColumnValueDensity(rows: unknown[][], columnIndex: number, sampleSize = 500): number {
  const totalRows = Math.min(sampleSize, rows.length);
  if (totalRows === 0) {
    return 0;
  }

  let nonEmptyValues = 0;
  for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
    const rawValue = rows[rowIndex]?.[columnIndex];
    const normalized = String(rawValue ?? "").trim();
    if (normalized.length > 0) {
      nonEmptyValues += 1;
    }
  }

  return nonEmptyValues / totalRows;
}

function pickBestColumnIndex(
  normalizedHeaders: string[],
  aliases: string[],
  rows: unknown[][],
): number {
  type Candidate = {
    columnIndex: number;
    score: number;
    density: number;
  };

  const candidates: Candidate[] = normalizedHeaders
    .map((header, columnIndex) => {
      const score = aliases.reduce((maxScore, alias, aliasIndex) => {
        const aliasPriority = aliases.length - aliasIndex;
        const currentScore = getHeaderAliasMatchScore(
          header,
          alias,
          aliasPriority,
        );
        return currentScore > maxScore ? currentScore : maxScore;
      }, 0);

      if (score === 0) {
        return null;
      }

      return {
        columnIndex,
        score,
        density: getColumnValueDensity(rows, columnIndex),
      };
    })
    .filter((candidate): candidate is Candidate => candidate !== null);

  if (candidates.length === 0) {
    return -1;
  }

  candidates.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    if (left.density !== right.density) {
      return right.density - left.density;
    }

    return left.columnIndex - right.columnIndex;
  });

  return candidates[0].columnIndex;
}

export function resolveColumnMap(
  headers: unknown[],
  headerAliases: Record<CanonicalField, string[]> = HEADER_ALIASES,
  rows: unknown[][] = [],
): ColumnMapResult {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const fieldToColumnIndex: Partial<Record<CanonicalField, number>> = {};

  for (const field of REQUIRED_IMPORT_FIELDS) {
    const aliases = headerAliases[field].map((alias) => normalizeHeader(alias));
    const columnIndex = pickBestColumnIndex(normalizedHeaders, aliases, rows);

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
