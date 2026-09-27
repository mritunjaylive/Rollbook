import test from "node:test";
import assert from "node:assert/strict";
import {
  getUserLocalParts,
  isMorningWindow,
  isEveningWindow,
  getUnmarkedPeriods,
  isValidTimeZone,
} from "./cron-utils.ts";

test("isValidTimeZone validates IANA timezones", () => {
  assert.equal(isValidTimeZone("Asia/Kolkata"), true);
  assert.equal(isValidTimeZone("America/New_York"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Invalid/Timezone_123"), false);
  assert.equal(isValidTimeZone(""), false);
});

test("getUserLocalParts calculates correct local parts across timezones", () => {
  // Fixed UTC timestamp: 2026-09-28T01:30:00Z (Monday)
  const d = new Date("2026-09-28T01:30:00Z");

  // UTC
  const utcParts = getUserLocalParts(d, "UTC");
  assert.equal(utcParts.hour, 1);
  assert.equal(utcParts.minute, 30);
  assert.equal(utcParts.dayOfWeek, 1); // Monday
  assert.equal(utcParts.isoDate, "2026-09-28");

  // Asia/Kolkata is UTC+5:30 -> 01:30 + 5:30 = 07:00 AM (Monday)
  const istParts = getUserLocalParts(d, "Asia/Kolkata");
  assert.equal(istParts.hour, 7);
  assert.equal(istParts.minute, 0);
  assert.equal(istParts.dayOfWeek, 1); // Monday
  assert.equal(istParts.isoDate, "2026-09-28");

  // America/New_York in late Sept is EDT (UTC-4) -> 2026-09-27 21:30 (Sunday)
  const edtParts = getUserLocalParts(d, "America/New_York");
  assert.equal(edtParts.hour, 21);
  assert.equal(edtParts.minute, 30);
  assert.equal(edtParts.dayOfWeek, 7); // Sunday
  assert.equal(edtParts.isoDate, "2026-09-27");

  // Fallback to UTC on null or invalid timezone
  const nullParts = getUserLocalParts(d, null);
  assert.equal(nullParts.hour, 1);
  assert.equal(nullParts.timeZone, "UTC");

  const invalidParts = getUserLocalParts(d, "garbage_timezone");
  assert.equal(invalidParts.hour, 1);
  assert.equal(invalidParts.timeZone, "UTC");
});

test("isMorningWindow detects 7:00 AM – 8:59 AM", () => {
  assert.equal(isMorningWindow(6), false);
  assert.equal(isMorningWindow(7), true);
  assert.equal(isMorningWindow(8), true);
  assert.equal(isMorningWindow(9), false);
  assert.equal(isMorningWindow(12), false);
  assert.equal(isMorningWindow(18), false);
});

test("isEveningWindow detects 6:00 PM – 9:59 PM", () => {
  assert.equal(isEveningWindow(7), false);
  assert.equal(isEveningWindow(12), false);
  assert.equal(isEveningWindow(17), false);
  assert.equal(isEveningWindow(18), true);
  assert.equal(isEveningWindow(19), true);
  assert.equal(isEveningWindow(20), true);
  assert.equal(isEveningWindow(21), true);
  assert.equal(isEveningWindow(22), false);
});

test("getUnmarkedPeriods correctly identifies scheduled periods with no attendance", () => {
  const periods = [
    { id: "p1", dayOfWeek: 1, subjectClosed: false },
    { id: "p2", dayOfWeek: 1, subjectClosed: false },
    { id: "p3", dayOfWeek: 1, subjectClosed: true }, // Closed subject -> ignored
    { id: "p4", dayOfWeek: 2, subjectClosed: false }, // Different weekday -> ignored
  ];

  // Case 1: No attendance marked today
  const unmarked1 = getUnmarkedPeriods(periods, [], 1, "2026-09-28");
  assert.equal(unmarked1.length, 2);
  assert.deepEqual(unmarked1.map((p) => p.id), ["p1", "p2"]);

  // Case 2: Period 1 was marked present/absent on today's date
  const unmarked2 = getUnmarkedPeriods(
    periods,
    [{ periodId: "p1", date: "2026-09-28" }],
    1,
    "2026-09-28",
  );
  assert.equal(unmarked2.length, 1);
  assert.equal(unmarked2[0].id, "p2");

  // Case 3: Attendance from yesterday doesn't count as marked today
  const unmarked3 = getUnmarkedPeriods(
    periods,
    [{ periodId: "p1", date: "2026-09-27" }],
    1,
    "2026-09-28",
  );
  assert.equal(unmarked3.length, 2);

  // Case 4: All today's active periods are marked
  const unmarked4 = getUnmarkedPeriods(
    periods,
    [
      { periodId: "p1", date: "2026-09-28" },
      { periodId: "p2", date: "2026-09-28" },
    ],
    1,
    "2026-09-28",
  );
  assert.equal(unmarked4.length, 0);
});
