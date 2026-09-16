import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MarkPad } from "@/components/mark-pad";
import { PercentRing } from "@/components/percent-ring";
import { StatsLine } from "@/components/stats-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { weekdayName } from "@/lib/rollbook/days";
import { statsForSemester, statsForSubject } from "@/lib/rollbook/derive";
import { projectedCredit } from "@/lib/rollbook/stats";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import type { AttendanceStatus, AttendanceStats, Period, Subject } from "@/lib/rollbook/types";
import { useClientDate } from "@/lib/use-client-date";
import { parseISODate } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: TodayPage });

function TodayPage() {
  const snapQ = useSnapshot();
  const snapshot = snapQ.data;
  const today = useClientDate();
  const mut = useRollbookMutations();

  const active = selectActive(snapshot);
  const threshold = snapshot?.profile?.thresholdPercent ?? 75;
  const overall =
    snapshot && active.semester
      ? statsForSemester(snapshot, active.semester.id, threshold)
      : null;
  const jsDay = today ? parseISODate(today).getDay() : null;
  const periodsToday = (jsDay && jsDay !== 0
    ? active.periods.filter((p) => p.dayOfWeek === jsDay)
    : []
  ).sort((a, b) => a.periodNumber - b.periodNumber || a.startTime.localeCompare(b.startTime));

  if (!snapshot || !today) {
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-[var(--radius-xl)] bg-line/60" />
      </AppShell>
    );
  }

  const todayIso = today;
  const subjectMap = new Map(active.subjects.map((s) => [s.id, s]));
  const markByPeriod = new Map(
    active.attendance.filter((a) => a.date === todayIso).map((a) => [a.periodId, a.status]),
  );

  async function mark(periodId: string, status: AttendanceStatus) {
    try {
      await mut.markAttendance.mutateAsync({ periodId, date: todayIso, status });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark class.");
    }
  }

  async function markHoliday() {
    if (periodsToday.length === 0) return;
    try {
      await mut.markDayStatus.mutateAsync({
        date: todayIso,
        status: "holiday",
        periodIds: periodsToday.map((p) => p.id),
      });
      toast.success("Day marked as holiday.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark holiday.");
    }
  }

  const closedBanner =
    active.semester &&
    (active.semester.classesOver || active.subjects.some((s) => s.closed)) &&
    overall &&
    overall.creditNeeded > 0;

  return (
    <AppShell>
      <section className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <PercentRing
          value={overall?.rawPercent ?? null}
          safe={!overall || overall.creditNeeded === 0}
          label="Overall"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
            {jsDay === 0 ? "Sunday" : weekdayName(jsDay ?? 0)} · {todayIso}
          </p>
          {overall ? (
            <div className="mt-2">
              <StatsLine stats={overall} />
            </div>
          ) : (
            <p className="mt-2 text-ink-soft">Create a semester to start counting.</p>
          )}
          {closedBanner ? (
            <p className="mt-3 rounded-[var(--radius-md)] bg-warn-soft px-3 py-2 text-sm text-warn">
              Classes have stopped for at least one paper, and credit is still open. Add
              teacher credit on that subject.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Today’s classes</h2>
          {periodsToday.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => void markHoliday()}>
              Whole day holiday
            </Button>
          ) : null}
        </div>

        {!active.semester ? (
          <EmptyCard
            title="No semester yet"
            body="Add your course and semester to start a roll."
            to="/setup"
            cta="Set up"
          />
        ) : jsDay === 0 ? (
          <EmptyCard
            title="No routine on Sunday"
            body="Catch up from the calendar, or rest."
            to="/calendar"
            cta="Open calendar"
          />
        ) : periodsToday.length === 0 ? (
          <EmptyCard
            title="Nothing on the timetable"
            body="Add today’s periods to the weekly routine."
            to="/timetable"
            cta="Edit routine"
          />
        ) : (
          <ul className="space-y-3">
            {periodsToday.map((p) => (
              <PeriodCard
                key={p.id}
                period={p}
                subject={subjectMap.get(p.subjectId)}
                status={markByPeriod.get(p.id) ?? null}
                onMark={(s) => void mark(p.id, s)}
                busy={mut.markAttendance.isPending}
                threshold={threshold}
                stats={
                  subjectMap.get(p.subjectId)
                    ? statsForSubject(snapshot, p.subjectId, threshold)
                    : null
                }
              />
            ))}
          </ul>
        )}
      </section>

      {active.subjects.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Subjects</h2>
            <Link to="/subjects" className="text-sm font-medium text-accent">
              All
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {active.subjects.map((s) => {
              const st = statsForSubject(snapshot, s.id, threshold);
              return (
                <li key={s.id}>
                  <Link
                    to="/subjects/$subjectId"
                    params={{ subjectId: s.id }}
                    className="block"
                  >
                    <Card>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-ink-faint">
                        {s.code || s.defaultTeacher || "Paper"}
                      </p>
                      <div className="mt-2">
                        <StatsLine stats={st} compact />
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}

function PeriodCard({
  period,
  subject,
  status,
  onMark,
  busy,
  threshold,
  stats,
}: {
  period: Period;
  subject?: Subject;
  status: AttendanceStatus | null;
  onMark: (s: AttendanceStatus) => void;
  busy?: boolean;
  threshold: number;
  stats: AttendanceStats | null;
}) {
  const nextPresent = stats ? projectedCredit(stats, "present", threshold) : null;
  const nextAbsent = stats ? projectedCredit(stats, "absent", threshold) : null;

  return (
    <Card>
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Period {period.periodNumber} · {period.startTime}–{period.endTime}
        </p>
        <h3 className="font-display text-xl font-semibold">
          {subject?.name ?? "Subject"}
        </h3>
        <p className="text-sm text-ink-soft">
          {period.teacherName || subject?.defaultTeacher || "No teacher set"}
        </p>
      </div>
      <MarkPad value={status} onChange={onMark} disabled={busy || subject?.closed} />
      {stats && stats.creditNeeded > 0 && nextPresent !== null && nextAbsent !== null ? (
        <p className="mt-2 text-xs text-ink-faint">
          Attend → credit {nextPresent} · Miss → credit {nextAbsent}
        </p>
      ) : null}
    </Card>
  );
}

function EmptyCard({
  title,
  body,
  to,
  cta,
}: {
  title: string;
  body: string;
  to: "/setup" | "/calendar" | "/timetable";
  cta: string;
}) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{body}</p>
      <Link to={to} className="mt-4 inline-flex">
        <Button>{cta}</Button>
      </Link>
    </Card>
  );
}
