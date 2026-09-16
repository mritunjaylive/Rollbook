import type { AttendanceStats } from "@/lib/rollbook/types";
import { formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function StatsLine({
  stats,
  compact,
}: {
  stats: AttendanceStats;
  compact?: boolean;
}) {
  const safe = stats.creditNeeded === 0 && stats.hosted > 0;
  const atRisk = stats.creditNeeded > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={cn(
            "font-display tabular-nums tracking-tight",
            compact ? "text-2xl" : "text-3xl",
            stats.hosted === 0
              ? "text-ink-faint"
              : safe
                ? "text-safe"
                : "text-warn",
          )}
        >
          {formatPercent(stats.rawPercent, stats.rawPercent && stats.rawPercent % 1 ? 1 : 0)}
        </p>
        <p className="text-sm text-ink-soft tabular-nums">
          {stats.present}/{stats.hosted} present
          {stats.teacherCredit > 0 ? ` · +${stats.teacherCredit} credit` : ""}
        </p>
      </div>
      {stats.hosted > 0 ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className={cn("h-full rounded-full", safe ? "bg-safe" : "bg-warn")}
            style={{ width: `${Math.min(100, stats.rawPercent ?? 0)}%` }}
          />
        </div>
      ) : (
        <p className="text-sm text-ink-faint">No hosted classes counted yet.</p>
      )}
      {atRisk ? (
        <p className="text-sm text-warn">
          Credit {stats.creditNeeded}
          {stats.attendToClear > 0
            ? ` · ${stats.attendToClear} more presents would also clear this`
            : ""}
        </p>
      ) : stats.hosted > 0 ? (
        <p className="text-sm text-safe">
          Safe
          {stats.bunkable > 0 ? ` · ${stats.bunkable} bunkable` : ""}
          {stats.teacherCredit > 0
            ? ` · effective ${formatPercent(stats.effectivePercent, 0)}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
