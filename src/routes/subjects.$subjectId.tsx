import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CreditForm } from "@/components/credit-form";
import { PercentRing } from "@/components/percent-ring";
import { StatsLine } from "@/components/stats-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CREDIT_TYPES, WEEKDAYS, weekdayName } from "@/lib/rollbook/days";
import { statsForSubject } from "@/lib/rollbook/derive";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import { computeStats, projectedCredit } from "@/lib/rollbook/stats";
import type { Period, Subject } from "@/lib/rollbook/types";
import { parseISODate } from "@/lib/utils";

export const Route = createFileRoute("/subjects/$subjectId")({
  component: SubjectDetailPage,
});

function SubjectDetailPage() {
  const { subjectId } = Route.useParams();
  const navigate = useNavigate();
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const subject = snapshot?.subjects.find((s) => s.id === subjectId);
  const threshold = snapshot?.profile?.thresholdPercent ?? 75;
  const mut = useRollbookMutations();
  const [creditOpen, setCreditOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [periodEditing, setPeriodEditing] = useState<Period | "new" | null>(null);

  if (!snapshot || !subject) {
    return (
      <AppShell>
        <p className="text-ink-soft">Subject not found.</p>
        <Link to="/subjects" className="mt-3 inline-block text-sm font-medium text-accent">
          ← Back
        </Link>
      </AppShell>
    );
  }

  const stats = statsForSubject(snapshot, subject.id, threshold);
  const credits = snapshot.credits.filter((c) => c.subjectId === subject.id);

  // All periods for this subject, sorted by day then period number
  const subjectPeriods = snapshot.periods
    .filter((p) => p.subjectId === subject.id)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodNumber - b.periodNumber);

  // Group periods by day
  const byDay = new Map<number, Period[]>();
  for (const p of subjectPeriods) {
    const list = byDay.get(p.dayOfWeek) ?? [];
    list.push(p);
    byDay.set(p.dayOfWeek, list);
  }

  const periodIds = new Set(subjectPeriods.map((p) => p.id));
  const history = snapshot.attendance
    .filter((a) => periodIds.has(a.periodId))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const noMore = subject.closed || Boolean(active.semester?.classesOver);

  // Unique teachers across all periods for this subject
  const teachers = [
    ...new Set(
      subjectPeriods
        .map((p) => p.teacherName)
        .concat(subject.defaultTeacher ?? "")
        .filter(Boolean),
    ),
  ];

  return (
    <AppShell>
      <Link to="/subjects" className="text-sm font-medium text-accent">
        ← All subjects
      </Link>

      {/* ── Header ── */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{subject.name}</h1>
          {(subject.code || teachers.length > 0) && (
            <p className="mt-1 text-sm text-ink-soft">
              {[subject.code, teachers.join(", ")].filter(Boolean).join(" · ")}
            </p>
          )}
          {subject.description && (
            <p className="mt-1.5 max-w-prose text-sm text-ink-faint">{subject.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button onClick={() => setCreditOpen(true)}>Add credit</Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <section className="mt-6 grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <PercentRing value={stats.rawPercent} safe={stats.creditNeeded === 0} label="This paper" />
        <StatsLine stats={stats} />
      </section>

      {/* ── Margin Predictor ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold mb-3">Margin Predictor</h2>
        <BunkPredictor stats={stats} threshold={threshold} />
      </section>



      {noMore && stats.creditNeeded > 0 ? (
        <p className="mt-4 rounded-[var(--radius-md)] bg-warn-soft px-3 py-2 text-sm text-warn">
          No more classes for this paper. {stats.creditNeeded} credit
          {stats.creditNeeded === 1 ? "" : "s"} must come from the teacher.
        </p>
      ) : null}

      <label className="mt-5 flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={subject.closed}
          onChange={(e) =>
            void mut.setSubjectClosed.mutateAsync({ id: subject.id, closed: e.target.checked })
          }
        />
        No more classes for this subject
      </label>

      {/* ── Schedule ── */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Class schedule</h2>
            <p className="text-sm text-ink-faint">
              {subjectPeriods.length === 0
                ? "No periods added yet."
                : `${subjectPeriods.length} period${subjectPeriods.length === 1 ? "" : "s"} per week`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPeriodEditing("new")}
            disabled={!active.semester}
          >
            <Plus className="size-4" />
            Period
          </Button>
        </div>

        {subjectPeriods.length === 0 ? (
          <button
            type="button"
            onClick={() => setPeriodEditing("new")}
            disabled={!active.semester}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] border-2 border-dashed border-line py-6 text-sm text-ink-faint hover:border-line-strong hover:text-ink-soft disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-4" />
            Add first period
          </button>
        ) : (
          <ul className="mt-3 space-y-2">
            {WEEKDAYS.filter((d) => byDay.has(d.n)).map((d) => (
              <li key={d.n}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  {d.full}
                </p>
                <ul className="space-y-2">
                  {(byDay.get(d.n) ?? []).map((p) => (
                    <li key={p.id}>
                      <Card className="flex items-center justify-between gap-3 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-accent/10 text-accent">
                            <Clock className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              Period {p.periodNumber} · {p.startTime}–{p.endTime}
                            </p>
                            <p className="text-xs text-ink-faint">
                              {p.teacherName || subject.defaultTeacher || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0">
                          <button
                            type="button"
                            aria-label="Edit period"
                            className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-ink-soft hover:bg-paper"
                            onClick={() => setPeriodEditing(p)}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete period"
                            className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-warn hover:bg-warn-soft"
                            onClick={async () => {
                              if (!confirm("Delete this period? Its attendance marks will be removed.")) return;
                              try {
                                await mut.deletePeriod.mutateAsync(p.id);
                                toast.success("Period removed.");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Could not delete.");
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Teacher credit ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Teacher credit</h2>
        {credits.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">None yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {credits.map((c) => (
              <li key={c.id}>
                <Card className="flex items-start justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">
                      {c.amount} class{c.amount === 1 ? "" : "es"} ·{" "}
                      {CREDIT_TYPES.find((t) => t.id === c.type)?.label ?? c.type}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {c.grantedOn}
                      {c.teacherName ? ` · ${c.teacherName}` : ""}
                      {c.note ? ` · ${c.note}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-warn"
                    onClick={() => void mut.deleteCreditGrant.mutateAsync(c.id)}
                  >
                    Remove
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Attendance history ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Marked classes</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">Nothing marked yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.slice(0, 40).map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                <span className="tabular-nums text-ink-soft">
                  {format(parseISODate(h.date), "EEE d MMM")}
                </span>
                <span
                  className={
                    h.status === "present"
                      ? "text-safe font-medium"
                      : h.status === "absent"
                        ? "text-warn font-medium"
                        : "capitalize text-ink-faint"
                  }
                >
                  {h.status === "cancelled" ? "not held" : h.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Danger zone ── */}
      <button
        type="button"
        className="mt-10 text-sm text-warn"
        onClick={async () => {
          if (!confirm("Delete this subject and all its marks?")) return;
          await mut.deleteSubject.mutateAsync(subject.id);
          toast.success("Subject removed.");
          void navigate({ to: "/subjects" });
        }}
      >
        Delete subject
      </button>

      {/* ── Dialogs ── */}
      <Dialog open={creditOpen} onOpenChange={setCreditOpen} title="Add teacher credit">
        <p className="mb-3 text-sm text-ink-soft">
          Use this after the teacher accepts notes, an assignment, or a project as makeup.
        </p>
        <CreditForm
          subject={subject}
          busy={mut.addCreditGrant.isPending}
          onSubmit={async (data) => {
            try {
              await mut.addCreditGrant.mutateAsync({ subjectId: subject.id, ...data });
              setCreditOpen(false);
              toast.success("Credit added.");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add credit.");
            }
          }}
        />
      </Dialog>

      <EditSubjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        subject={subject}
      />

      {periodEditing !== null && active.semester ? (
        <PeriodDialog
          period={periodEditing === "new" ? null : periodEditing}
          semesterId={active.semester.id}
          subjectId={subject.id}
          defaultTeacher={subject.defaultTeacher ?? ""}
          onClose={() => setPeriodEditing(null)}
        />
      ) : null}
    </AppShell>
  );
}

// ── Edit subject dialog ────────────────────────────────────────────────────────

function EditSubjectDialog({
  open,
  onOpenChange,
  subject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject: Subject;
}) {
  const mut = useRollbookMutations();
  const [name, setName] = useState(subject.name);
  const [code, setCode] = useState(subject.code ?? "");
  const [teacher, setTeacher] = useState(subject.defaultTeacher ?? "");
  const [description, setDescription] = useState(subject.description ?? "");

  // Keep local state in sync if the subject prop changes (e.g. after a save)
  const subjectKey = subject.id + subject.name + subject.code + subject.defaultTeacher + subject.description;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit subject">
      <form
        key={subjectKey}
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await mut.upsertSubject.mutateAsync({
              id: subject.id,
              semesterId: subject.semesterId,
              name,
              code: code || null,
              defaultTeacher: teacher || null,
              description: description || null,
            });
            onOpenChange(false);
            toast.success("Subject updated.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save.");
          }
        }}
      >
        <Field label="Subject name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Subject code">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CS301 (optional)"
          />
        </Field>
        <Field label="Default teacher">
          <Input
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder="Primary faculty"
          />
        </Field>
        <Field label="Notes / description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Room number, syllabus notes, multiple teachers… (optional)"
            className="min-h-20"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={mut.upsertSubject.isPending}>
          {mut.upsertSubject.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Dialog>
  );
}

// ── Period dialog (add / edit) ─────────────────────────────────────────────────

function PeriodDialog({
  period,
  semesterId,
  subjectId,
  defaultTeacher,
  onClose,
}: {
  period: Period | null;
  semesterId: string;
  subjectId: string;
  defaultTeacher: string;
  onClose: () => void;
}) {
  const mut = useRollbookMutations();
  const [dayOfWeek, setDayOfWeek] = useState(period?.dayOfWeek ?? 1);
  const [periodNumber, setPeriodNumber] = useState(period?.periodNumber ?? 1);
  const [startTime, setStartTime] = useState(period?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(period?.endTime ?? "09:50");
  const [teacherName, setTeacherName] = useState(
    period?.teacherName ?? defaultTeacher,
  );

  return (
    <Dialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={period ? "Edit period" : "Add period"}
    >
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await mut.upsertPeriod.mutateAsync({
              id: period?.id,
              semesterId,
              subjectId,
              dayOfWeek,
              periodNumber,
              startTime,
              endTime,
              teacherName,
            });
            onClose();
            toast.success(period ? "Period updated." : "Period added.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save period.");
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Day">
            <Select
              value={String(dayOfWeek)}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
            >
              {WEEKDAYS.map((d) => (
                <option key={d.n} value={d.n}>
                  {d.full}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Period no.">
            <Input
              type="number"
              min={1}
              max={12}
              value={periodNumber}
              onChange={(e) => setPeriodNumber(Number(e.target.value) || 1)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Teacher for this slot">
          <Input
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            placeholder="Leave blank to inherit default teacher"
          />
        </Field>
        <div className="flex gap-2 pt-1">
          {period ? (
            <Button
              type="button"
              variant="outline"
              className="text-warn"
              onClick={async () => {
                if (!confirm("Delete this period? Its attendance marks will be removed.")) return;
                await mut.deletePeriod.mutateAsync(period.id);
                onClose();
                toast.success("Period removed.");
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : null}
          <Button
            type="submit"
            className="ml-auto"
            disabled={mut.upsertPeriod.isPending}
          >
            {mut.upsertPeriod.isPending ? "Saving…" : period ? "Save changes" : "Add period"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Margin Predictor ───────────────────────────────────────────────────────────

function BunkPredictor({ stats, threshold }: { stats: any; threshold: number }) {
  const [offset, setOffset] = useState(0); // negative = miss, positive = attend

  const simulatedPresent = stats.present + (offset > 0 ? offset : 0);
  const simulatedAbsent = stats.absent + (offset < 0 ? Math.abs(offset) : 0);
  const simulated = computeStats(simulatedPresent, simulatedAbsent, stats.teacherCredit, threshold, {
    holiday: stats.holiday,
    cancelled: stats.cancelled,
  });

  const isSafe = simulated.creditNeeded === 0;

  return (
    <Card className="p-4 bg-paper/50">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-soft">Simulate upcoming classes</p>
          <div className="flex items-center gap-3 bg-paper rounded-[var(--radius-sm)] px-2 py-1 border border-line">
            <button
              onClick={() => setOffset((o) => o - 1)}
              className="text-warn hover:opacity-80 font-bold px-2"
              aria-label="Skip a class"
            >
              - Skip
            </button>
            <span className="tabular-nums font-medium min-w-4 text-center">
              {offset > 0 ? `+${offset}` : offset}
            </span>
            <button
              onClick={() => setOffset((o) => o + 1)}
              className="text-safe hover:opacity-80 font-bold px-2"
              aria-label="Attend a class"
            >
              + Attend
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-line border-dashed">
          <div>
            <p className="text-xs text-ink-faint uppercase tracking-wider">Projected %</p>
            <p className={`text-xl font-display font-semibold ${isSafe ? "text-safe" : "text-warn"}`}>
              {simulated.effectivePercent !== null ? simulated.effectivePercent.toFixed(1) : "0.0"}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-faint uppercase tracking-wider">Status</p>
            <p className={`text-sm font-medium ${isSafe ? "text-safe" : "text-warn"}`}>
              {isSafe ? "Safe" : `Short by ${simulated.creditNeeded}`}
            </p>
          </div>
        </div>

        {offset !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)} className="text-xs mt-1 self-start">
            Reset
          </Button>
        )}
      </div>
    </Card>
  );
}
