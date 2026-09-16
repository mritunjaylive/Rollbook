import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { WEEKDAYS, weekdayName } from "@/lib/rollbook/days";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import type { Period } from "@/lib/rollbook/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/timetable")({ component: TimetablePage });

function TimetablePage() {
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const [day, setDay] = useState(1);
  const [editing, setEditing] = useState<Period | null | "new">(null);
  const mut = useRollbookMutations();

  const byDay = useMemo(() => {
    const map = new Map<number, Period[]>();
    for (const p of active.periods) {
      const list = map.get(p.dayOfWeek) ?? [];
      list.push(p);
      map.set(p.dayOfWeek, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.periodNumber - b.periodNumber);
    }
    return map;
  }, [active.periods]);

  const subjectName = (id: string) =>
    active.subjects.find((s) => s.id === id)?.name ?? "Subject";

  const periodNumbers = [...new Set(active.periods.map((p) => p.periodNumber))].sort(
    (a, b) => a - b,
  );

  async function remove(id: string) {
    if (!confirm("Delete this period? Marks for it will be removed.")) return;
    try {
      await mut.deletePeriod.mutateAsync(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Routine</h1>
          <p className="text-sm text-ink-soft">Monday–Saturday. Different papers, different hours.</p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          disabled={!active.semester || active.subjects.length === 0}
        >
          <Plus className="size-4" />
          Period
        </Button>
      </div>

      {!active.semester ? (
        <p className="mt-6 text-ink-soft">Set up a semester first.</p>
      ) : active.subjects.length === 0 ? (
        <p className="mt-6 text-ink-soft">Add a subject before building the timetable.</p>
      ) : (
        <>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
            {WEEKDAYS.map((d) => (
              <button
                key={d.n}
                type="button"
                onClick={() => setDay(d.n)}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                  day === d.n ? "bg-accent text-accent-fg" : "bg-page text-ink-soft shadow-[var(--shadow-card)]",
                )}
              >
                {d.short}
              </button>
            ))}
          </div>

          <ul className="mt-4 space-y-2 md:hidden">
            {(byDay.get(day) ?? []).map((p) => (
              <li key={p.id}>
                <Card className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      Period {p.periodNumber} · {p.startTime}–{p.endTime}
                    </p>
                    <p className="font-medium">{subjectName(p.subjectId)}</p>
                    <p className="text-sm text-ink-soft">{p.teacherName || "—"}</p>
                  </div>
                  <div className="flex">
                    <button
                      type="button"
                      className="grid size-11 place-items-center text-ink-soft"
                      onClick={() => setEditing(p)}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="grid size-11 place-items-center text-warn"
                      onClick={() => void remove(p.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </Card>
              </li>
            ))}
            {(byDay.get(day) ?? []).length === 0 ? (
              <p className="text-sm text-ink-faint">No periods on {weekdayName(day)}.</p>
            ) : null}
          </ul>

          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className="w-16 text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    Period
                  </th>
                  {WEEKDAYS.map((d) => (
                    <th
                      key={d.n}
                      className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint"
                    >
                      {d.full}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(periodNumbers.length ? periodNumbers : [1]).map((n) => (
                  <tr key={n}>
                    <td className="align-top pt-3 text-sm font-medium text-ink-soft">{n}</td>
                    {WEEKDAYS.map((d) => {
                      const cell = (byDay.get(d.n) ?? []).find((p) => p.periodNumber === n);
                      return (
                        <td key={d.n} className="align-top">
                          {cell ? (
                            <button
                              type="button"
                              onClick={() => setEditing(cell)}
                              className="w-full rounded-[var(--radius-md)] bg-page p-3 text-left shadow-[var(--shadow-card)] hover:bg-paper"
                            >
                              <p className="font-medium leading-snug">{subjectName(cell.subjectId)}</p>
                              <p className="text-xs text-ink-faint">
                                {cell.startTime}–{cell.endTime}
                              </p>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditing("new")}
                              className="flex h-16 w-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-line text-ink-faint hover:border-line-strong"
                            >
                              <Plus className="size-4" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing !== null && active.semester ? (
        <PeriodDialog
          period={editing === "new" ? null : editing}
          semesterId={active.semester.id}
          subjects={active.subjects}
          defaultDay={day}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </AppShell>
  );
}

function PeriodDialog({
  period,
  semesterId,
  subjects,
  defaultDay,
  onClose,
}: {
  period: Period | null;
  semesterId: string;
  subjects: { id: string; name: string; defaultTeacher: string | null }[];
  defaultDay: number;
  onClose: () => void;
}) {
  const mut = useRollbookMutations();
  const [subjectId, setSubjectId] = useState(period?.subjectId ?? subjects[0]?.id ?? "");
  const [dayOfWeek, setDayOfWeek] = useState(period?.dayOfWeek ?? defaultDay);
  const [periodNumber, setPeriodNumber] = useState(period?.periodNumber ?? 1);
  const [startTime, setStartTime] = useState(period?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(period?.endTime ?? "09:50");
  const [teacherName, setTeacherName] = useState(
    period?.teacherName ?? subjects.find((s) => s.id === (period?.subjectId ?? subjects[0]?.id))?.defaultTeacher ?? "",
  );

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
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
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save period.");
          }
        }}
      >
        <Field label="Subject">
          <Select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              const t = subjects.find((s) => s.id === e.target.value)?.defaultTeacher;
              if (t && !teacherName) setTeacherName(t);
            }}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
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
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Ends">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <Field label="Teacher">
          <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
        </Field>
        <div className="flex gap-2 pt-1">
          {period ? (
            <Button
              type="button"
              variant="outline"
              className="text-warn"
              onClick={async () => {
                if (!confirm("Delete this period?")) return;
                await mut.deletePeriod.mutateAsync(period.id);
                onClose();
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button type="submit" className="ml-auto" disabled={mut.upsertPeriod.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
