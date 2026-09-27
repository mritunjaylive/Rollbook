/**
 * CSV generation utilities conforming to RFC 4180.
 */

/**
 * Escapes a single CSV field value.
 * Wraps in double-quotes if it contains a comma, quote, or newline (\n, \r).
 * Embedded double-quotes are doubled ("" per RFC 4180).
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvReportRow {
  name: string;
  code: string | null;
  teachers: string;
  held: number;
  present: number;
  absent: number;
  holiday: number;
  cancelled: number;
  teacherCredit: number;
  rawPercent: number | null;
  effectivePercent: number | null;
  creditNeeded: number;
}

/**
 * Builds the complete RFC 4180 CSV string for the attendance report.
 */
export function buildCsv(rows: CsvReportRow[]): string {
  const header = [
    "Subject",
    "Code",
    "Teacher(s)",
    "Held",
    "Present",
    "Absent",
    "Holiday",
    "Cancelled",
    "Teacher Credit",
    "Raw %",
    "Effective %",
    "Credits to clear",
  ]
    .map(csvField)
    .join(",");

  const body = rows.map((r) =>
    [
      csvField(r.name),
      csvField(r.code),
      csvField(r.teachers),
      csvField(r.held),
      csvField(r.present),
      csvField(r.absent),
      csvField(r.holiday),
      csvField(r.cancelled),
      csvField(r.teacherCredit),
      csvField(r.rawPercent == null ? "" : r.rawPercent.toFixed(1)),
      csvField(r.effectivePercent == null ? "" : r.effectivePercent.toFixed(1)),
      csvField(r.creditNeeded),
    ].join(","),
  );

  return [header, ...body].join("\r\n");
}
