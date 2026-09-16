import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeStats } from "./stats.ts";

describe("computeStats", () => {
  it("8 hosted, 5 present → 62.5%, credit 1, 4 attends to clear", () => {
    const s = computeStats(5, 3, 0, 75);
    assert.equal(s.hosted, 8);
    assert.equal(s.rawPercent, 62.5);
    assert.equal(s.creditNeeded, 1);
    assert.equal(s.attendToClear, 4);
    assert.equal(s.bunkable, 0);
  });

  it("teacher credit of 1 clears the till-date debt", () => {
    const s = computeStats(5, 3, 1, 75);
    assert.equal(s.creditNeeded, 0);
    assert.equal(s.effectivePercent, 75);
    assert.equal(s.rawPercent, 62.5);
    assert.equal(s.attendToClear, 0);
  });

  it("missing one class raises credit", () => {
    const before = computeStats(5, 3, 0, 75);
    const after = computeStats(5, 4, 0, 75);
    assert.equal(before.creditNeeded, 1);
    assert.equal(after.creditNeeded, 2);
    assert.ok(after.rawPercent! < before.rawPercent!);
  });

  it("attending enough classes zeros credit (9/12)", () => {
    const s = computeStats(9, 3, 0, 75);
    assert.equal(s.rawPercent, 75);
    assert.equal(s.creditNeeded, 0);
  });

  it("already safe reports bunkable classes", () => {
    const s = computeStats(7, 1, 0, 75);
    assert.equal(s.creditNeeded, 0);
    assert.equal(s.bunkable, 1);
  });

  it("no hosted classes yet", () => {
    const s = computeStats(0, 0, 0, 75);
    assert.equal(s.rawPercent, null);
    assert.equal(s.creditNeeded, 0);
  });
});
