/**
 * Pure unit tests for the upsertSemester schema and field-mask logic.
 *
 * These run with node --experimental-strip-types --test.
 * No server, no DB, no bundler needed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

// ── Inline the same schemas as api.ts (kept in sync) ─────────────────────────

const semesterCreateInput = z.object({
  id: z.undefined().optional(),
  termId: z.string().optional().nullable(),
  courseName: z.string().trim().min(1).max(160),
  semesterName: z.string().trim().min(1).max(80),
  startDate: z.string().nullable().optional(),
  makeActive: z.boolean().optional(),
});

const semesterEditInput = z.object({
  id: z.string(),
  termId: z.string().optional().nullable(),
  courseName: z.string().trim().min(1).max(160).optional(),
  semesterName: z.string().trim().min(1).max(80),
  startDate: z.string().nullable().optional(),
  makeActive: z.boolean().optional(),
});

const semesterInput = z.union([semesterEditInput, semesterCreateInput]);

// ── Helper that mirrors the field-mask logic in upsertSemester edit branch ────

function editFields(data: {
  id: string;
  semesterName: string;
  courseName?: string;
  termId?: string | null;
  startDate?: string | null;
  makeActive?: boolean;
}) {
  return {
    semesterName: true,                    // always updated
    courseName:  data.courseName !== undefined,
    termId:      data.termId !== undefined, // null counts as defined (explicit detach)
    startDate:   data.startDate !== undefined,
    isActive:    data.makeActive === true, // only true when explicitly true
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("semesterInput schema", () => {
  it("accepts a name-only rename payload", () => {
    const payload = { id: "sem-1", semesterName: "Routine B" };
    const parsed = semesterInput.parse(payload);
    assert.equal((parsed as { id?: string }).id, "sem-1");
    assert.equal(parsed.semesterName, "Routine B");
    assert.equal(parsed.courseName, undefined);
    assert.equal(parsed.makeActive, undefined);
  });

  it("accepts a create payload", () => {
    const payload = { courseName: "B.Tech CSE", semesterName: "Routine 1", startDate: "2025-07-01" };
    const parsed = semesterInput.parse(payload);
    assert.equal((parsed as { id?: string }).id, undefined);
    assert.equal(parsed.courseName, "B.Tech CSE");
  });

  it("rejects a create payload without courseName", () => {
    const payload = { semesterName: "Routine 1" };
    assert.throws(() => semesterInput.parse(payload));
  });

  it("accepts an edit payload with explicit null termId", () => {
    const payload = { id: "sem-1", semesterName: "Routine B", termId: null };
    const parsed = semesterInput.parse(payload) as { termId?: string | null };
    assert.equal(parsed.termId, null);
  });
});

describe("upsertSemester edit-branch field-mask logic", () => {
  it("rename-only: only semesterName is touched", () => {
    const f = editFields({ id: "sem-1", semesterName: "Routine B" });
    assert.equal(f.semesterName, true,  "semesterName must be updated");
    assert.equal(f.courseName,  false,  "courseName must NOT be updated");
    assert.equal(f.termId,      false,  "termId must NOT be updated");
    assert.equal(f.startDate,   false,  "startDate must NOT be updated");
    assert.equal(f.isActive,    false,  "is_active must NOT change");
  });

  it("makeActive===true: is_active IS changed", () => {
    assert.equal(editFields({ id: "sem-1", semesterName: "R", makeActive: true }).isActive, true);
  });

  it("makeActive===false: is_active NOT changed", () => {
    assert.equal(editFields({ id: "sem-1", semesterName: "R", makeActive: false }).isActive, false);
  });

  it("makeActive===undefined: is_active NOT changed", () => {
    assert.equal(editFields({ id: "sem-1", semesterName: "R" }).isActive, false);
  });

  it("explicit null termId: termId IS updated", () => {
    assert.equal(editFields({ id: "sem-1", semesterName: "R", termId: null }).termId, true);
  });

  it("undefined termId: termId NOT updated", () => {
    assert.equal(editFields({ id: "sem-1", semesterName: "R" }).termId, false);
  });
});
