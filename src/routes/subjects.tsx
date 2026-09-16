import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatsLine } from "@/components/stats-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { weekdayName } from "@/lib/rollbook/days";
import { statsForSubject } from "@/lib/rollbook/derive";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";

export const Route = createFileRoute("/subjects")({ component: SubjectsPage });

function SubjectsPage() {
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const threshold = snapshot?.profile?.thresholdPercent ?? 75;
  const mut = useRollbookMutations();

  const [addOpen, setAddOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teacher, setTeacher] = useState("");

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Subjects</h1>
          <p className="text-sm text-ink-soft">
            {active.semester
              ? `${active.semester.semesterName} · ${active.semester.courseName}`
              : "No active semester"}
          </p>
        </div>
        <div className="flex gap-2">
          {active.semester && active.subjects.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setArchiveOpen(true)}
              title="Archive this routine and start a fresh one"
            >
              <Archive className="size-4" />
              <span className="hidden sm:inline">Archive routine</span>
            </Button>
          )}
          <Button onClick={() => setAddOpen(true)} disabled={!active.semester}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>

      {active.subjects.length === 0 ? (
        <p className="mt-6 text-ink-soft">No subjects yet. Add the papers you attend.</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {active.subjects.map((s) => {
            const st = snapshot ? statsForSubject(snapshot, s.id, threshold) : null;

            // Periods for this subject in the active semester
            const periods = active.periods
              .filter((p) => p.subjectId === s.id)
              .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodNumber - b.periodNumber);

            // Unique teachers across all periods + defaultTeacher
            const teachers = [
              ...new Set(
                periods
                  .map((p) => p.teacherName)
                  .concat(s.defaultTeacher ?? "")
                  .filter(Boolean),
              ),
            ];

            // Day abbreviations for the schedule preview, e.g. "Mon · Wed · Fri"
            const dayLabels = [
              ...new Set(periods.map((p) => weekdayName(p.dayOfWeek, "short"))),
            ].join(" · ");

            return (
              <li key={s.id} className="flex flex-col">
                <Link
                  to="/subjects/$subjectId"
                  params={{ subjectId: s.id }}
                  className="block"
                >
                  <Card
                    className={`transition-shadow hover:shadow-[var(--shadow-card-hover,var(--shadow-card))] ${
                      s.closed ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`truncate font-medium ${s.closed ? "line-through text-ink-soft" : ""}`}
                        >
                          {s.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-ink-faint">
                          {s.code ? (
                            <span className="mr-1.5 rounded bg-line px-1.5 py-0.5 font-mono text-[11px]">
                              {s.code}
                            </span>
                          ) : null}
                          {teachers.length > 0 ? teachers.join(", ") : "No teacher set"}
                        </p>
                      </div>
                      {/* attendance % badge */}
                      {st?.rawPercent != null && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            st.creditNeeded === 0
                              ? "bg-safe/15 text-safe"
                              : "bg-warn/15 text-warn"
                          }`}
                        >
                          {st.rawPercent.toFixed(0)}%
                        </span>
                      )}
                    </div>

                    {/* schedule preview */}
                    {periods.length > 0 && (
                      <p className="mt-2 text-xs text-ink-faint">
                        {periods.length} period{periods.length === 1 ? "" : "s"} ·{" "}
                        {dayLabels}
                      </p>
                    )}

                    {st ? (
                      <div className="mt-3">
                        <StatsLine stats={st} compact />
                      </div>
                    ) : null}
                  </Card>
                </Link>

                {/* "No more classes" toggle — sits outside the Link so it
                    doesn't navigate when tapped */}
                <label className="mt-1.5 flex cursor-pointer items-center gap-2 px-1 text-xs text-ink-faint select-none">
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={s.closed}
                    onChange={(e) => {
                      void mut.setSubjectClosed
                        .mutateAsync({ id: s.id, closed: e.target.checked })
                        .then(() =>
                          toast.success(
                            e.target.checked
                              ? `${s.name} marked as completed.`
                              : `${s.name} re-opened.`,
                          ),
                        )
                        .catch((err) =>
                          toast.error(
                            err instanceof Error ? err.message : "Could not update.",
                          ),
                        );
                    }}
                  />
                  {s.closed ? "Completed — no more classes" : "Mark as completed"}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Add subject dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add subject">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!active.semester) return;
            try {
              await mut.upsertSubject.mutateAsync({
                semesterId: active.semester.id,
                name,
                code: code || null,
                defaultTeacher: teacher || null,
              });
              setName("");
              setCode("");
              setTeacher("");
              setAddOpen(false);
              toast.success("Subject added.");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add subject.");
            }
          }}
        >
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Data Structures"
            />
          </Field>
          <Field label="Subject code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CS301 (optional)"
            />
          </Field>
          <Field label="Teacher">
            <Input
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder="Primary faculty (optional)"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={mut.upsertSubject.isPending}>
            {mut.upsertSubject.isPending ? "Saving…" : "Add subject"}
          </Button>
        </form>
      </Dialog>

      {/* ── Archive routine dialog ── */}
      {active.semester && (
        <ArchiveRoutineDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          currentSemester={active.semester}
        />
      )}
    </AppShell>
  );
}

// ── Archive routine dialog ────────────────────────────────────────────────────

function ArchiveRoutineDialog({
  open,
  onOpenChange,
  currentSemester,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentSemester: { id: string; semesterName: string; courseName: string };
}) {
  const mut = useRollbookMutations();
  const [newName, setNewName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Archive routine & start fresh">
      <div className="mb-4 rounded-[var(--radius-md)] bg-paper px-3 py-2.5 text-sm text-ink-soft">
        <p className="font-medium text-ink">What this does</p>
        <ul className="mt-1.5 space-y-1 text-xs">
          <li>• The current semester ("{currentSemester.semesterName}") is archived — its attendance history is kept.</li>
          <li>• A new semester is created with the same subjects copied over.</li>
          <li>• The new semester starts with a <strong>blank timetable</strong> — add your updated routine from scratch.</li>
          <li>• Teachers, codes, and notes on each subject carry over.</li>
        </ul>
      </div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          try {
            await mut.archiveRoutine.mutateAsync({
              semesterId: currentSemester.id,
              newSemesterName: newName.trim(),
            });
            onOpenChange(false);
            setNewName("");
            toast.success("Routine archived. Add your new timetable periods.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not archive routine.");
          }
        }}
      >
        <Field label="Name for the new semester">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`e.g. ${currentSemester.semesterName} (revised)`}
            required
          />
        </Field>
        <Button
          type="submit"
          className="w-full"
          disabled={mut.archiveRoutine.isPending || !newName.trim()}
        >
          {mut.archiveRoutine.isPending ? "Archiving…" : "Archive & start fresh"}
        </Button>
      </form>
    </Dialog>
  );
}
