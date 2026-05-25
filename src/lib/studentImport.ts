import * as XLSX from "xlsx";
import { z } from "zod";

export const STUDENT_IMPORT_HEADERS = [
  "student_id_number",
  "first_name",
  "last_name",
  "other_names",
  "combination",
  "date_of_birth",
  "gender",
  "national_id",
  "nationality",
  "religion",
  "blood_group",
  "photo_url",
  "address",
  "previous_school",
  "admission_date",
  "enrollment_year",
  "student_type",
  "status"
] as const;

type StudentImportHeader = (typeof STUDENT_IMPORT_HEADERS)[number];

type StudentImportRow = {
  student_id_number?: string;
  first_name: string;
  last_name: string;
  other_names?: string;
  combination?: string;
  date_of_birth?: string | Date;
  gender?: string;
  national_id?: string;
  nationality?: string;
  religion?: string;
  blood_group?: string;
  photo_url?: string;
  address?: string;
  previous_school?: string;
  admission_date?: string | Date;
  enrollment_year?: number;
  student_type?: string;
  status?: string;
};

export type StudentImportIssue = {
  row: number;
  message: string;
  type: "header" | "validation" | "duplicate";
};

export type StudentImportParseResult = {
  totalRows: number;
  validRows: StudentImportRow[];
  issues: StudentImportIssue[];
};

const studentImportSchema = z.object({
  student_id_number: z.string().optional(),
  first_name: z.string().min(1, "first_name is required"),
  last_name: z.string().min(1, "last_name is required"),
  other_names: z.string().optional(),
  combination: z.string().optional(),
  date_of_birth: z.union([z.string(), z.date()]).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  national_id: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  blood_group: z.string().optional(),
  photo_url: z.string().optional(),
  address: z.string().optional(),
  previous_school: z.string().optional(),
  admission_date: z.union([z.string(), z.date()]).optional(),
  enrollment_year: z.coerce.number().int().min(1900).max(2100).optional(),
  student_type: z.enum(["boarding", "day"]).optional(),
  status: z.enum(["active", "inactive", "transferred", "graduated", "expelled"]).optional()
});

const REQUIRED_HEADERS: StudentImportHeader[] = ["first_name", "last_name"];

const stripBom = (value: string) => value.replace(/^\uFEFF/, "");

const normalizeHeaderKey = (value: string) =>
  stripBom(value).trim().toLowerCase().replace(/[\s-]+/g, "_");

const normalizeCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  return text.length ? text : undefined;
};

const normalizeEnumValue = (value?: string) =>
  value ? value.trim().toLowerCase() : undefined;

const buildHeaderMap = (headers: string[]) => {
  const map = new Map<number, StudentImportHeader>();
  const lookup = new Map<string, StudentImportHeader>();

  STUDENT_IMPORT_HEADERS.forEach((header) => {
    lookup.set(normalizeHeaderKey(header), header);
  });

  headers.forEach((header, index) => {
    const normalized = normalizeHeaderKey(header);
    const canonical = lookup.get(normalized);
    if (canonical) {
      map.set(index, canonical);
    }
  });

  return map;
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(current);
    current = "";
  };

  const pushRow = () => {
    if (row.length === 0 && current.length === 0) {
      return;
    }
    pushCell();
    const hasContent = row.some((cell) => cell.trim().length > 0);
    if (hasContent) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === "\"") {
      if (inQuotes && text[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      pushCell();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      pushRow();
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
};

const readFileAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });

const readFileAsArrayBuffer = (file: File) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });

const parseXlsx = (buffer: ArrayBuffer) => {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
};

const escapeCsv = (value: string) => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

export const buildStudentImportCsv = (rows: StudentImportRow[]) => {
  const headerLine = STUDENT_IMPORT_HEADERS.join(",");
  const body = rows.map((row) =>
    STUDENT_IMPORT_HEADERS.map((header) => {
      const value = row[header] ?? "";
      return escapeCsv(String(value));
    }).join(",")
  );

  return "\uFEFF" + [headerLine, ...body].join("\n");
};

export const makeStudentImportCsvFile = (
  rows: StudentImportRow[],
  filename: string
) => {
  const csv = buildStudentImportCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  return new File([blob], filename, { type: "text/csv" });
};

export const downloadStudentImportTemplate = (
  filename = "ecareafrica-students-template.csv"
) => {
  const csv = buildStudentImportCsv([]);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const parseStudentImportFile = async (file: File): Promise<StudentImportParseResult> => {
  const issues: StudentImportIssue[] = [];
  const extension = file.name.split(".").pop()?.toLowerCase();

  const rows = extension === "xlsx" || extension === "xls"
    ? parseXlsx(await readFileAsArrayBuffer(file))
    : parseCsv(await readFileAsText(file));

  if (!rows.length) {
    return { totalRows: 0, validRows: [], issues: [{ row: 0, message: "File is empty", type: "header" }] };
  }

  const rawHeaders = rows[0].map((cell) => String(cell ?? ""));
  const headerMap = buildHeaderMap(rawHeaders);
  const missing = REQUIRED_HEADERS.filter((header) =>
    Array.from(headerMap.values()).every((value) => value !== header)
  );

  if (missing.length) {
    issues.push({
      row: 1,
      message: `Missing required columns: ${missing.join(", ")}`,
      type: "header"
    });
  }

  if (!headerMap.size) {
    issues.push({
      row: 1,
      message: "No recognized headers were found",
      type: "header"
    });
  }

  const parsedRows: { rowNumber: number; record: StudentImportRow }[] = [];
  let totalRows = 0;

  rows.slice(1).forEach((row, index) => {
    const record: Record<string, string | undefined> = {};

    headerMap.forEach((header, columnIndex) => {
      const value = normalizeCellValue(row[columnIndex]);
      if (value !== undefined) {
        record[header] = value;
      }
    });

    if (!Object.keys(record).length) {
      return;
    }

    totalRows += 1;

    const normalized: StudentImportRow = {
      ...record,
      gender: normalizeEnumValue(record.gender),
      student_type: normalizeEnumValue(record.student_type),
      status: normalizeEnumValue(record.status)
    };

    const result = studentImportSchema.safeParse(normalized);
    const rowNumber = index + 2;

    if (!result.success) {
      const message = result.error.errors.map((issue) => issue.message).join("; ");
      issues.push({ row: rowNumber, message, type: "validation" });
      return;
    }

    parsedRows.push({ rowNumber, record: result.data });
  });

  const dedupedRows: StudentImportRow[] = [];
  const seenStudentIds = new Map<string, number>();
  const seenNationalIds = new Map<string, number>();
  const seenNameDob = new Map<string, number>();

  parsedRows.forEach(({ rowNumber, record }) => {
    const studentId = record.student_id_number?.toLowerCase();
    const nationalId = record.national_id?.toLowerCase();
    const nameDobKey = [
      record.first_name.toLowerCase(),
      record.last_name.toLowerCase(),
      record.date_of_birth ? String(record.date_of_birth).toLowerCase() : ""
    ].join("|");

    if (studentId) {
      const firstRow = seenStudentIds.get(studentId);
      if (firstRow) {
        issues.push({
          row: rowNumber,
          message: `Duplicate student_id_number (also in row ${firstRow})`,
          type: "duplicate"
        });
        return;
      }
      seenStudentIds.set(studentId, rowNumber);
    }

    if (nationalId) {
      const firstRow = seenNationalIds.get(nationalId);
      if (firstRow) {
        issues.push({
          row: rowNumber,
          message: `Duplicate national_id (also in row ${firstRow})`,
          type: "duplicate"
        });
        return;
      }
      seenNationalIds.set(nationalId, rowNumber);
    }

    if (record.date_of_birth) {
      const firstRow = seenNameDob.get(nameDobKey);
      if (firstRow) {
        issues.push({
          row: rowNumber,
          message: `Possible duplicate student (same name and date of birth as row ${firstRow})`,
          type: "duplicate"
        });
        return;
      }
      seenNameDob.set(nameDobKey, rowNumber);
    }

    dedupedRows.push(record);
  });

  return {
    totalRows,
    validRows: dedupedRows,
    issues
  };
};

export type { StudentImportRow };
