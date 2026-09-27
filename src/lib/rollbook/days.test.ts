import test from "node:test";
import assert from "node:assert/strict";
import { WEEKDAYS, periodInput } from "./days.ts";

test("WEEKDAYS is strictly Monday–Saturday (exactly 6 days, numbers 1 through 6)", () => {
  // Sunday is deliberately excluded from recurring routine.
  assert.equal(WEEKDAYS.length, 6, "WEEKDAYS must contain exactly 6 days (Monday to Saturday)");
  const numbers = WEEKDAYS.map((d) => d.n);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6]);

  for (const day of WEEKDAYS) {
    assert.ok(
      day.n >= 1 && day.n <= 6,
      `Day ${day.short} (n=${day.n}) must be between 1 and 6 inclusive`,
    );
    assert.notEqual(day.n, 0, "Sunday as 0 must never be added to WEEKDAYS");
    assert.notEqual(day.n, 7, "Sunday as 7 must never be added to WEEKDAYS");
  }
});

test("periodInput validation strictly enforces dayOfWeek between 1 and 6 (rejects Sunday 0 and 7)", () => {
  const base = {
    semesterId: "sem-test",
    subjectId: "sub-test",
    periodNumber: 1,
    startTime: "09:00",
    endTime: "10:00",
  };

  // Valid weekdays 1..6 (Monday through Saturday) must succeed
  for (let day = 1; day <= 6; day++) {
    const valid = periodInput.safeParse({ ...base, dayOfWeek: day });
    assert.equal(valid.success, true, `dayOfWeek: ${day} should be accepted`);
  }

  // Sunday representations (0 or 7) must be rejected
  const sunday0 = periodInput.safeParse({ ...base, dayOfWeek: 0 });
  assert.equal(sunday0.success, false, "dayOfWeek: 0 (Sunday) must be rejected");

  const sunday7 = periodInput.safeParse({ ...base, dayOfWeek: 7 });
  assert.equal(sunday7.success, false, "dayOfWeek: 7 (Sunday) must be rejected");

  // Out of range integers must also be rejected
  assert.equal(periodInput.safeParse({ ...base, dayOfWeek: -1 }).success, false);
  assert.equal(periodInput.safeParse({ ...base, dayOfWeek: 8 }).success, false);

  // Non-integers must be rejected
  assert.equal(periodInput.safeParse({ ...base, dayOfWeek: 2.5 }).success, false);
});
