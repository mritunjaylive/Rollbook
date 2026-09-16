import { createFileRoute } from "@tanstack/react-router";
import {
  addDays,
  eachDayOfInterval,
  format,
  isAfter,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MarkPad } from "@/components/mark-pad";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { weekdayName } from "@/lib/rollbook/days";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import type { AttendanceStatus } from "@/lib/rollbook/types";
import { useMonthCursor } from "@/lib/use-client-date";
import { cn, localISODate, parseISODate } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

function CalendarPage() {
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const { today, iso, date, prevMonth, nextMonth, selectDay } = useMonthCursor();
  const mut = useRollbookMutations();
  const [focus, setFocus] = useState<string | null>(null);
  const selected = focus ?? iso ?? today;

  const days = useMemo(() => {
    if (!date) return [];
    const start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    const end = addDays(start, 41);
    return eachDayOfInterval({ start, end });
  }, [date]);

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const a of active.attendance) set.add(a.date);
    return set;
  }, [active.attendance]);

  if (!selected || !today) {
    return (
      <AppShell>
        <div className="h-64 animate-pulse rounded-[var(--radius-xl)] bg-line/60" />
      </AppShell>
    );
  }

  const selectedIso = selected;
  const todayIso = today;
  const selectedDate = parseISODate(selectedIso);
  const jsDay = selectedDate.getDay();
  const periods =
    jsDay === 0
      ? []
      : active.periods
          .filter((p) => p.dayOfWeek === jsDay)
          .sort((a, b) => a.periodNumber - b.periodNumber);
  const marks = new Map(
    active.attendance
      .filter((a) => a.date === selectedIso)
      .map((a) => [a.periodId, a.status]),
  );
  const future = isAfter(parseISODate(selectedIso), parseISODate(todayIso));
  const monthStart = date ? startOfMonth(date) : parseISODate(selectedIso);
  const inMonth = (d: Date) => d.getMonth() === monthStart.getMonth();

  async function mark(periodId: string, status: AttendanceStatus) {
    try {
      await mut.markAttendance.mutateAsync({ periodId, date: selectedIso, status });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark.");
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">
          {date ? format(date, "MMMM yyyy") : "Calendar"}
        </h1>
        <div className="flex">
          <button type="button" className="grid size-11 place-items-center" onClick={prevMonth}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" className="grid size-11 place-items-center" onClick={nextMonth}>
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = localISODate(d);
          const on = key === selectedIso;
          const isToday = key === todayIso;
          const has = markedDates.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                selectDay(key);
                setFocus(key);
              }}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-[var(--radius-sm)] text-sm tabular-nums",
                !inMonth(d) && "text-ink-faint/50",
                on && "bg-accent text-accent-fg",
                !on && isToday && "bg-safe-soft text-safe",
                !on && !isToday && "hover:bg-line/70",
              )}
            >
              {d.getDate()}
              <span
                className={cn(
                  "mt-0.5 size-1 rounded-full",
                  has ? (on ? "bg-accent-fg" : "bg-accent") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">
            {format(selectedDate, "EEEE d MMM")}
          </h2>
          {periods.length > 0 && !future ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void mut.markDayStatus.mutateAsync({
                  date: selectedIso,
                  status: "holiday",
                  periodIds: periods.map((p) => p.id),
                })
              }
            >
              Day holiday
            </Button>
          ) : null}
        </div>
        {jsDay === 0 ? (
          <p className="text-sm text-ink-soft">Sunday — no routine.</p>
        ) : periods.length === 0 ? (
          <p className="text-sm text-ink-soft">No periods on {weekdayName(jsDay)}.</p>
        ) : future ? (
          <p className="text-sm text-ink-soft">Future days can be seen, not marked.</p>
        ) : (
          <ul className="space-y-3">
            {periods.map((p) => {
              const subject = active.subjects.find((s) => s.id === p.subjectId);
              return (
                <li key={p.id}>
                  <Card>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      Period {p.periodNumber} · {p.startTime}–{p.endTime}
                    </p>
                    <p className="mb-3 font-medium">{subject?.name ?? "Subject"}</p>
                    <MarkPad
                      value={marks.get(p.id) ?? null}
                      onChange={(s) => void mark(p.id, s)}
                    />
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
