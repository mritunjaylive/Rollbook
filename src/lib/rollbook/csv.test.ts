import test from "node:test";
import assert from "node:assert/strict";
import { csvField, buildCsv, type CsvReportRow } from "./csv.ts";

test("csvField escapes plain string without quotes", () => {
  assert.equal(csvField("Mathematics"), "Mathematics");
  assert.equal(csvField("CS101"), "CS101");
});

test("csvField handles null, undefined, and numbers", () => {
  assert.equal(csvField(null), "");
  assert.equal(csvField(undefined), "");
  assert.equal(csvField(0), "0");
  assert.equal(csvField(75.5), "75.5");
});

test("csvField quotes strings containing commas", () => {
  assert.equal(csvField("Dr. Smith, Jr."), '"Dr. Smith, Jr."');
});

test("csvField doubles quotes per RFC 4180", () => {
  assert.equal(csvField('Special "Notes"'), '"Special ""Notes"""');
});

test("csvField quotes strings containing newlines", () => {
  assert.equal(csvField("Line 1\nLine 2"), '"Line 1\nLine 2"');
  assert.equal(csvField("Line 1\r\nLine 2"), '"Line 1\r\nLine 2"');
});

test("buildCsv formats header and data rows correctly with CRLF", () => {
  const rows: CsvReportRow[] = [
    {
      name: "Data Structures",
      code: "CS201",
      teachers: "Prof. Alan, Prof. Grace",
      held: 20,
      present: 18,
      absent: 2,
      holiday: 1,
      cancelled: 0,
      teacherCredit: 2,
      rawPercent: 90.0,
      effectivePercent: 100.0,
      creditNeeded: 0,
    },
    {
      name: 'Algorithms & "Analysis"',
      code: null,
      teachers: "Prof. Knuth",
      held: 10,
      present: 6,
      absent: 4,
      holiday: 0,
      cancelled: 1,
      teacherCredit: 0,
      rawPercent: 60.0,
      effectivePercent: 60.0,
      creditNeeded: 2,
    },
  ];

  const csv = buildCsv(rows);
  const lines = csv.split("\r\n");

  assert.equal(lines.length, 3);
  assert.equal(
    lines[0],
    "Subject,Code,Teacher(s),Held,Present,Absent,Holiday,Cancelled,Teacher Credit,Raw %,Effective %,Credits to clear",
  );
  // Row 1: Teachers contains comma, so wrapped in quotes
  assert.equal(
    lines[1],
    'Data Structures,CS201,"Prof. Alan, Prof. Grace",20,18,2,1,0,2,90.0,100.0,0',
  );
  // Row 2: Name contains double quotes, so escaped as "" and wrapped in quotes; code is null -> empty
  assert.equal(
    lines[2],
    '"Algorithms & ""Analysis""",,Prof. Knuth,10,6,4,0,1,0,60.0,60.0,2',
  );
});

test("buildCsv handles term-wide subject groups and period-level teachers", () => {
  const rows: CsvReportRow[] = [
    {
      name: "Visual Programming",
      code: "BCA401",
      teachers: "Prof. VP Teacher",
      held: 1,
      present: 1,
      absent: 0,
      holiday: 0,
      cancelled: 0,
      teacherCredit: 0,
      rawPercent: 100.0,
      effectivePercent: 100.0,
      creditNeeded: 0,
    },
    {
      name: "E-Commerce",
      code: "BCA402",
      teachers: "Prof. EC Period Teacher",
      held: 1,
      present: 1,
      absent: 0,
      holiday: 0,
      cancelled: 0,
      teacherCredit: 0,
      rawPercent: 100.0,
      effectivePercent: 100.0,
      creditNeeded: 0,
    },
  ];

  const csv = buildCsv(rows);
  const lines = csv.split("\r\n");

  assert.equal(lines.length, 3);
  assert.equal(
    lines[1],
    "Visual Programming,BCA401,Prof. VP Teacher,1,1,0,0,0,0,100.0,100.0,0",
  );
  assert.equal(
    lines[2],
    "E-Commerce,BCA402,Prof. EC Period Teacher,1,1,0,0,0,0,100.0,100.0,0",
  );
});
