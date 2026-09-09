/**
 * Shared Excel export utility — used across all portals.
 * Uses ExcelJS (already installed) for rich .xlsx output.
 */
import ExcelJS from "exceljs";

export type ExportColumn = {
  header: string;
  key: string;
  width?: number;
};

export type ExportRow = Record<string, string | number | null | undefined>;

/**
 * Download data as an .xlsx file.
 * @param filename  e.g. "attendance-2026-09-09.xlsx"
 * @param sheetName e.g. "Attendance"
 * @param columns   column definitions (header + key + optional width)
 * @param rows      data rows — each row is a plain object
 * @param title     optional bold title in cell A1 (row 1 is the title, row 2 headers)
 */
export async function exportToExcel(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  title?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EcaAfrica";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  let headerRow = 1;

  // Optional title row
  if (title) {
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell("A1");
    titleCell.value = title;
    titleCell.font = { bold: true, size: 13 };
    titleCell.alignment = { horizontal: "center" };
    headerRow = 2;
  }

  // Column widths
  sheet.columns = columns.map((c) => ({
    header: "",
    key: c.key,
    width: c.width ?? 20,
  }));

  // Header row
  const hRow = sheet.getRow(headerRow);
  columns.forEach((c, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3B5998" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center" };
  });
  hRow.commit();

  // Data rows
  rows.forEach((row, idx) => {
    const r = sheet.getRow(headerRow + 1 + idx);
    columns.forEach((c, ci) => {
      r.getCell(ci + 1).value = row[c.key] ?? "";
    });
    // Alternating row fill
    if (idx % 2 === 0) {
      r.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
      });
    }
    r.commit();
  });

  // Border on all cells
  const lastRow = headerRow + rows.length;
  for (let r = headerRow; r <= lastRow; r++) {
    for (let c = 1; c <= columns.length; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = {
        top:    { style: "thin", color: { argb: "FFD0D0D0" } },
        left:   { style: "thin", color: { argb: "FFD0D0D0" } },
        bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
        right:  { style: "thin", color: { argb: "FFD0D0D0" } },
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convenience: export to CSV */
export function exportToCSV(filename: string, columns: ExportColumn[], rows: ExportRow[]): void {
  const header = columns.map((c) => `"${c.header}"`).join(",");
  const dataRows = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [header, ...dataRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
