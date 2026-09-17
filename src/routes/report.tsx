import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { selectActive, useSnapshot } from "@/lib/rollbook/queries";
import { statsForSubject } from "@/lib/rollbook/derive";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/report")({
  component: ReportPage,
});

function ReportPage() {
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const profile = snapshot?.profile;

  // Auto-trigger print if query param specifies it, but a manual button is better.
  const threshold = profile?.thresholdPercent ?? 75;

  if (!snapshot || !active.semester) {
    return (
      <div className="p-8 text-center text-ink-soft">
        <p>No active semester data found.</p>
      </div>
    );
  }

  const overallAttended = active.subjects.reduce((sum, s) => sum + statsForSubject(snapshot, s.id, threshold).present, 0);
  const overallHeld = active.subjects.reduce((sum, s) => sum + statsForSubject(snapshot, s.id, threshold).held, 0);
  const overallPercent = overallHeld === 0 ? 0 : Math.round((overallAttended / overallHeld) * 100);

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0 print:m-0">
      <div className="print:hidden mb-8 flex justify-end">
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
            <p><span className="font-semibold w-24 inline-block">Course:</span> {active.semester.courseName}</p>
            <p><span className="font-semibold w-24 inline-block">Semester:</span> {active.semester.semesterName}</p>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="mb-10 p-4 bg-gray-50 border border-gray-200 rounded text-center">
          <p className="text-lg">
            Overall Attendance: <span className="font-bold text-xl">{overallPercent}%</span> 
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
            {active.subjects.map((s) => {
              const stats = statsForSubject(snapshot, s.id, threshold);
              return (
                <tr key={s.id} className="border-b border-gray-200">
                  <td className="py-3 px-4 font-medium">{s.name}</td>
                  <td className="py-3 px-4 text-gray-600">{s.defaultTeacher || "—"}</td>
                  <td className="py-3 px-2 text-right">{stats.held}</td>
                  <td className="py-3 px-2 text-right">{stats.present}</td>
                  <td className="py-3 px-2 text-right">{stats.absent}</td>
                  <td className="py-3 px-2 text-right">{stats.totalCredits}</td>
                  <td className="py-3 px-4 text-right font-semibold">
                    {stats.percent}%
                  </td>
                </tr>
              );
            })}
            {active.subjects.length === 0 && (
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
