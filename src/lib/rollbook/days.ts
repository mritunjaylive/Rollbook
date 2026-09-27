import { z } from "zod";

// Rollbook's recurring routine is intentionally Monday–Saturday (1–6) only.
// Sunday is deliberately excluded and must NOT be added here to represent
// occasional/exceptional classes. For one-off Sunday classes, workshops, or
// weekend events, use the Teacher Credit system (credit_grants / addCreditGrant)
// instead. See README.md's Timetable section for full architectural rationale.
export const WEEKDAYS = [
  { n: 1, short: "Mon", full: "Monday" },
  { n: 2, short: "Tue", full: "Tuesday" },
  { n: 3, short: "Wed", full: "Wednesday" },
  { n: 4, short: "Thu", full: "Thursday" },
  { n: 5, short: "Fri", full: "Friday" },
  { n: 6, short: "Sat", full: "Saturday" },
] as const;

export function weekdayName(n: number, form: "short" | "full" = "full") {
  const row = WEEKDAYS.find((d) => d.n === n);
  if (!row) return n === 0 ? "Sunday" : "Day";
  return form === "short" ? row.short : row.full;
}

export const CREDIT_TYPES = [
  { id: "notes", label: "Notes" },
  { id: "assignment", label: "Assignment" },
  { id: "project", label: "Project" },
  { id: "other", label: "Other" },
] as const;

export const ACTIVITY_KINDS = [
  { id: "workshop", label: "Workshop" },
  { id: "activity", label: "Activity" },
  { id: "fest", label: "Fest" },
  { id: "game", label: "Game" },
  { id: "other", label: "Other" },
] as const;

export const periodInput = z.object({
  id: z.string().optional(),
  semesterId: z.string(),
  subjectId: z.string(),
  // Intentionally constrained to Monday–Saturday (1–6). Sunday (0 or 7) is
  // deliberately excluded and must NOT be added here. For occasional/exceptional
  // Sunday classes, use the Teacher Credit system (credit_grants / addCreditGrant).
  dayOfWeek: z.number().int().min(1).max(6),
  periodNumber: z.number().int().min(1).max(12),
  startTime: z.string().min(4).max(8),
  endTime: z.string().min(4).max(8),
  teacherName: z.string().trim().max(120).optional(),
});
