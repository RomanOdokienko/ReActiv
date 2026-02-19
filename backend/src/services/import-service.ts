import { randomUUID } from "node:crypto";
import { createImportBatch, updateImportBatchSummary } from "../repositories/import-batch-repository";
import { insertImportError } from "../repositories/import-error-repository";
import { insertVehicleOffer } from "../repositories/vehicle-offer-repository";
import { normalizeVehicleOfferRow } from "../import/normalize-row";
import { resolveColumnMap } from "../import/resolve-column-map";
import { validateNormalizedRow } from "../import/validate-normalized-row";
import { readExcel } from "./excel-reader";

interface ImportServiceInput {
  filename: string;
  fileBuffer: Buffer;
  logger?: {
    info: (context: Record<string, unknown>, message: string) => void;
    error: (context: Record<string, unknown>, message: string) => void;
  };
}

interface ImportServiceErrorItem {
  rowNumber: number;
  field: string | null;
  message: string;
}

export interface ImportServiceResult {
  importBatchId: string;
  status: "completed" | "completed_with_errors" | "failed";
  summary: {
    totalRows: number;
    importedRows: number;
    skippedRows: number;
  };
  errors: ImportServiceErrorItem[];
}

const MAX_RESPONSE_ERRORS = 100;

export function importWorkbook(input: ImportServiceInput): ImportServiceResult {
  const importBatchId = randomUUID();

  createImportBatch({
    id: importBatchId,
    filename: input.filename,
    status: "failed",
  });

  const errors: ImportServiceErrorItem[] = [];
  let totalRows = 0;
  let importedRows = 0;
  let skippedRows = 0;

  input.logger?.info(
    {
      import_batch_id: importBatchId,
      filename: input.filename,
    },
    "import_started",
  );

  try {
    const parsedWorkbook = readExcel(input.fileBuffer);
    totalRows = parsedWorkbook.rows.length;

    const columnMap = resolveColumnMap(parsedWorkbook.headers);

    if (columnMap.missingRequiredFields.length > 0) {
      for (const missingField of columnMap.missingRequiredFields) {
        const message = `Missing required column: ${missingField}`;
        insertImportError({
          import_batch_id: importBatchId,
          row_number: 1,
          field: missingField,
          message,
        });

        if (errors.length < MAX_RESPONSE_ERRORS) {
          errors.push({ rowNumber: 1, field: missingField, message });
        }
      }

      skippedRows = totalRows;
      updateImportBatchSummary({
        id: importBatchId,
        status: "failed",
        total_rows: totalRows,
        imported_rows: importedRows,
        skipped_rows: skippedRows,
      });

      return {
        importBatchId,
        status: "failed",
        summary: { totalRows, importedRows, skippedRows },
        errors,
      };
    }

    parsedWorkbook.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const normalizedRow = normalizeVehicleOfferRow(row, columnMap.fieldToColumnIndex);
      const validationErrors = validateNormalizedRow(normalizedRow);

      if (validationErrors.length > 0) {
        skippedRows += 1;
        for (const validationError of validationErrors) {
          insertImportError({
            import_batch_id: importBatchId,
            row_number: rowNumber,
            field: validationError.field,
            message: validationError.message,
          });

          if (errors.length < MAX_RESPONSE_ERRORS) {
            errors.push({
              rowNumber,
              field: validationError.field,
              message: validationError.message,
            });
          }
        }
        return;
      }

      insertVehicleOffer(importBatchId, normalizedRow);
      importedRows += 1;
    });

    const status = skippedRows > 0 ? "completed_with_errors" : "completed";

    updateImportBatchSummary({
      id: importBatchId,
      status,
      total_rows: totalRows,
      imported_rows: importedRows,
      skipped_rows: skippedRows,
    });

    return {
      importBatchId,
      status,
      summary: {
        totalRows,
        importedRows,
        skippedRows,
      },
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error";
    insertImportError({
      import_batch_id: importBatchId,
      row_number: 0,
      field: null,
      message,
    });

    updateImportBatchSummary({
      id: importBatchId,
      status: "failed",
      total_rows: totalRows,
      imported_rows: importedRows,
      skipped_rows: skippedRows,
    });

    input.logger?.error(
      {
        import_batch_id: importBatchId,
        error: message,
      },
      "import_failed",
    );

    throw error;
  } finally {
    input.logger?.info(
      {
        import_batch_id: importBatchId,
        total_rows: totalRows,
        imported_rows: importedRows,
        skipped_rows: skippedRows,
      },
      "import_completed",
    );
  }
}
