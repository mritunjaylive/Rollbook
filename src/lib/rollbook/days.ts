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
