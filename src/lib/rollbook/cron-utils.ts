/**
 * Pure timezone and scheduling helper functions for Rollbook cron jobs.
 *
 * NOTE ON VERCEL HOBBY CRON LIMITATION:
 * The Vercel Hobby plan only supports daily-granularity cron schedules (at most once
 * per day per job). Therefore, instead of running an hourly cron per timezone,
 * the cron runs at fixed UTC times (e.g. 01:30 UTC for morning, 15:30 UTC for evening),
 * and each run inspects every subscriber's local time (derived from their stored IANA
 * timezone) to verify they fall within the target local morning or evening window.
 */

/**
 * Validates whether an IANA timezone string is recognized by Intl.
 */
export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface UserLocalParts {
  hour: number;
  minute: number;
  /** 1=Monday, 2=Tuesday, ..., 6=Saturday, 7=Sunday (matches Rollbook weekday convention) */
  dayOfWeek: number;
  /** "YYYY-MM-DD" in user's local timezone */
  isoDate: string;
  /** Effective timezone used (falls back to "UTC" if invalid or omitted) */
  timeZone: string;
}

/**
 * Derives local time parts (hour, minute, dayOfWeek 1-7, and YYYY-MM-DD date)
 * for a given timestamp and IANA timezone string.
 * Falls back safely to UTC if timezone is absent or invalid.
 */
export function getUserLocalParts(
  date: Date = new Date(),
  timeZone?: string | null,
): UserLocalParts {
  const effectiveTz = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";

  // Use Intl.DateTimeFormat with hourCycle: "h23" (00-23)
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: effectiveTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });

  const parts = dtf.formatToParts(date);
  let hour = 0;
  let minute = 0;
  let year = "1970";
  let month = "01";
  let day = "01";
  let weekday = "Mon";

  for (const part of parts) {
    if (part.type === "hour") hour = parseInt(part.value, 10);
    else if (part.type === "minute") minute = parseInt(part.value, 10);
    else if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
    else if (part.type === "weekday") weekday = part.value;
  }

  // Rollbook weekday convention: 1 = Mon, 2 = Tue, ..., 6 = Sat, 7 = Sun
  const weekdayToNumber: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const dayOfWeek = weekdayToNumber[weekday] ?? 1;
  const isoDate = `${year}-${month}-${day}`;

  return {
    hour,
    minute,
    dayOfWeek,
    isoDate,
    timeZone: effectiveTz,
  };
}

/**
 * Checks whether user's local hour falls in the morning notification window.
 * Default target: 7:00 AM – 8:59 AM local.
 */
export function isMorningWindow(hour: number): boolean {
  return hour >= 7 && hour < 9;
}

/**
 * Checks whether user's local hour falls in the evening reminder window.
 * Default target: 6:00 PM – 9:59 PM local (18:00 – 21:59).
 */
export function isEveningWindow(hour: number): boolean {
  return hour >= 18 && hour < 22;
}

export interface PeriodItem {
  id: string;
  dayOfWeek: number;
  subjectClosed?: boolean;
}

export interface AttendanceItem {
  periodId: string;
  date: string;
}

/**
 * Identifies periods for today's weekday that have no attendance marked yet.
 */
export function getUnmarkedPeriods(
  periods: PeriodItem[],
  attendanceEntries: AttendanceItem[],
  targetDayOfWeek: number,
  targetIsoDate: string,
): PeriodItem[] {
  const markedPeriodIds = new Set(
    attendanceEntries
      .filter((a) => a.date === targetIsoDate)
      .map((a) => a.periodId),
  );

  return periods.filter(
    (p) =>
      p.dayOfWeek === targetDayOfWeek &&
      !p.subjectClosed &&
      !markedPeriodIds.has(p.id),
  );
}
