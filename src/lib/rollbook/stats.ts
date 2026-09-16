import type { AttendanceEntry, AttendanceStats, AttendanceStatus, CreditGrant } from "./types";

export function computeStats(
  present: number,
  absent: number,
  teacherCredit: number,
  thresholdPercent: number,
  extra?: { holiday?: number; cancelled?: number },
): AttendanceStats {
  const hosted = Math.max(0, present) + Math.max(0, absent);
  const C = Math.max(0, teacherCredit);
  const r = Math.min(0.99, Math.max(0.01, thresholdPercent / 100));
  const holiday = extra?.holiday ?? 0;
  const cancelled = extra?.cancelled ?? 0;

  if (hosted === 0) {
    return {
      hosted: 0,
      present,
      absent,
      holiday,
      cancelled,
      teacherCredit: C,
      rawPercent: null,
      effectivePercent: null,
      creditNeeded: 0,
      bunkable: 0,
      attendToClear: 0,
    };
  }

  const rawPercent = (100 * present) / hosted;
  const effectivePercent = (100 * (present + C)) / hosted;
  const required = Math.ceil(r * hosted);
  const creditNeeded = Math.max(0, required - present - C);

  let bunkable = 0;
  if (creditNeeded === 0) {
    bunkable = Math.max(0, Math.floor((present + C) / r - hosted));
  }

  let attendToClear = 0;
  if (creditNeeded > 0) {
    const denom = 1 - r;
    const n = (r * hosted - present - C) / denom;
    attendToClear = Math.max(0, Math.ceil(n - 1e-9));
  }

  return {
    hosted,
    present,
    absent,
    holiday,
    cancelled,
    teacherCredit: C,
    rawPercent,
    effectivePercent,
    creditNeeded,
    bunkable,
    attendToClear,
  };
}

export function tallyMarks(
  entries: AttendanceEntry[],
  credits: CreditGrant[],
  thresholdPercent: number,
): AttendanceStats {
  let present = 0;
  let absent = 0;
  let holiday = 0;
  let cancelled = 0;
  for (const e of entries) {
    if (e.status === "present") present += 1;
    else if (e.status === "absent") absent += 1;
    else if (e.status === "holiday") holiday += 1;
    else if (e.status === "cancelled") cancelled += 1;
  }
  const teacherCredit = credits.reduce((sum, g) => sum + g.amount, 0);
  return computeStats(present, absent, teacherCredit, thresholdPercent, {
    holiday,
    cancelled,
  });
}

export function isHostedStatus(status: AttendanceStatus) {
  return status === "present" || status === "absent";
}

export function projectedCredit(
  stats: AttendanceStats,
  next: "present" | "absent",
  thresholdPercent: number,
): number {
  const present = stats.present + (next === "present" ? 1 : 0);
  const absent = stats.absent + (next === "absent" ? 1 : 0);
  return computeStats(present, absent, stats.teacherCredit, thresholdPercent)
    .creditNeeded;
}
