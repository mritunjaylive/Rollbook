import { createFileRoute } from "@tanstack/react-router";
import { selectActive, useSnapshot } from "@/lib/rollbook/queries";
import {
  groupSubjectsByOrigin,
  statsForSubjectGroup,
  statsForTerm,
  teachersForSubjectGroup,
} from "@/lib/rollbook/derive";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { localISODate } from "@/lib/utils";
import { toast } from "sonner";
import { buildCsv, type CsvReportRow } from "@/lib/rollbook/csv";

export const Route = createFileRoute("/report")({
  component: ReportPage,
});

function ReportPage() {
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const profile = snapshot?.profile;

  const threshold = profile?.thresholdPercent ?? 75;

  if (!snapshot || !active.semester) {
    return (
      <div className="p-8 text-center text-ink-soft">
        <p>No active semester data found.</p>
      </div>
    );
  }

  const activeTerm = active.term;
  const termRoutines = active.routines.length > 0 ? active.routines : [active.semester];
  const routineSemesterIds = new Set(termRoutines.map((r) => r.id));
  const termName = activeTerm?.name ?? active.semester.semesterName;
  const courseName = termRoutines[0]?.courseName ?? active.semester.courseName;

  // Group subjects across all routines in the term
  const subjectGroups = Array.from(
    groupSubjectsByOrigin(snapshot.subjects, routineSemesterIds).values(),
  );

  // Overall attendance using statsForTerm
  const overallStats = statsForTerm(snapshot, activeTerm?.id ?? active.semester.termId, threshold);
  const overallAttended = overallStats.present;
  const overallHeld = overallStats.hosted;
  const overallPercent =
    overallHeld === 0 ? 0 : Math.round((overallAttended / overallHeld) * 100);

  function exportCsv() {
    try {
      const rows: CsvReportRow[] = subjectGroups.map((group) => {
        const primary = group[group.length - 1] ?? group[0];
        const st = statsForSubjectGroup(snapshot!, group, threshold);
        const teachers = teachersForSubjectGroup(snapshot!.periods, group).join("; ");
        const code = group.find((s) => s.code)?.code ?? null;
        return {
          name: primary.name,
          code,
          teachers,
          held: st.hosted,
          present: st.present,
          absent: st.absent,
          holiday: st.holiday,
          cancelled: st.cancelled,
          teacherCredit: st.teacherCredit,
          rawPercent: st.rawPercent,
          effectivePercent: st.effectivePercent,
          creditNeeded: st.creditNeeded,
        };
      });

      const csv = buildCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rollbook-report-${localISODate()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export CSV.");
    }
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0 print:m-0">
      <div className="print:hidden mb-8 flex justify-end gap-3">
        <Button variant="outline" onClick={() => exportCsv()} className="gap-2">
          <FileDown className="size-4" />
          Export CSV
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="size-4" />
          Print PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto border border-gray-300 p-10 print:border-none print:p-0">
        {/* Header */}
        <div className="text-center mb-10 border-b-2 border-black pb-6">
          <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">
            {profile?.collegeName || "College / University"}
          </h1>
          <h2 className="text-xl font-semibold text-gray-700">Attendance Report</h2>
          <p className="text-sm text-gray-500 mt-2">
            Generated on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Student Info */}
        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
          <div>
            <p><span className="font-semibold w-24 inline-block">Name:</span> {profile?.studentName || "—"}</p>
            <p><span className="font-semibold w-24 inline-block">ID / Roll No:</span> {profile?.studentId || "—"}</p>
          </div>
          <div>
            <p><span className="font-semibold w-24 inline-block">Course:</span> {courseName}</p>
            <p><span className="font-semibold w-24 inline-block">Semester:</span> {termName}</p>
            {profile?.session ? (
              <p><span className="font-semibold w-24 inline-block">Session:</span> {profile.session}</p>
            ) : null}
            <p className="text-xs text-gray-500 mt-1">
              Routines included: {termRoutines.map((r) => r.semesterName).join(", ") || "—"}
            </p>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="mb-10 p-4 bg-gray-50 border border-gray-200 rounded text-center">
          <p className="text-lg">
            Overall Attendance: <span className="font-bold text-xl">{overallPercent}%</span>{" "}
            <span className="text-sm text-gray-500 ml-2">({overallAttended} / {overallHeld} classes)</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Required Threshold: {threshold}%</p>
        </div>

        {/* Table */}
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="py-3 px-4 font-semibold">Subject</th>
              <th className="py-3 px-4 font-semibold">Teacher</th>
              <th className="py-3 px-2 font-semibold text-right">Held</th>
              <th className="py-3 px-2 font-semibold text-right">Present</th>
              <th className="py-3 px-2 font-semibold text-right">Absent</th>
              <th className="py-3 px-2 font-semibold text-right">Credits</th>
              <th className="py-3 px-4 font-semibold text-right">Percentage</th>
            </tr>
          </thead>
          <tbody>
            {subjectGroups.map((group) => {
              const primary = group[group.length - 1] ?? group[0];
              const stats = statsForSubjectGroup(snapshot, group, threshold);
              const teacherList = teachersForSubjectGroup(snapshot.periods, group);
              const teachers = teacherList.join("; ") || "—";
              return (
                <tr key={primary.id} className="border-b border-gray-200">
                  <td className="py-3 px-4 font-medium">{primary.name}</td>
                  <td className="py-3 px-4 text-gray-600">{teachers}</td>
                  <td className="py-3 px-2 text-right">{stats.hosted}</td>
                  <td className="py-3 px-2 text-right">{stats.present}</td>
                  <td className="py-3 px-2 text-right">{stats.absent}</td>
                  <td className="py-3 px-2 text-right">{stats.teacherCredit}</td>
                  <td className="py-3 px-4 text-right font-semibold">
                    {stats.effectivePercent != null ? `${stats.effectivePercent.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
            {subjectGroups.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">
                  No subjects found in this semester.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer Signatures */}
        <div className="mt-24 flex justify-between px-10">
          <div className="text-center">
            <div className="w-40 border-t border-black pt-2">Student Signature</div>
          </div>
          <div className="text-center">
            <div className="w-40 border-t border-black pt-2">HOD / Coordinator</div>
          </div>
        </div>
      </div>
    </div>
  );
}
