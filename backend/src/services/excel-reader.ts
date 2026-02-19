import * as XLSX from "xlsx";

export interface ExcelReadResult {
  headers: unknown[];
  rows: unknown[][];
}

export function readExcel(buffer: Buffer): ExcelReadResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const firstNonEmptySheetName = workbook.SheetNames.find((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    return rows.length > 0;
  });

  if (!firstNonEmptySheetName) {
    throw new Error("No non-empty worksheet found");
  }

  const worksheet = workbook.Sheets[firstNonEmptySheetName];
  const allRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];

  if (allRows.length === 0) {
    throw new Error("Worksheet has no rows");
  }

  const [headers, ...rows] = allRows;

  return {
    headers: headers ?? [],
    rows,
  };
}
