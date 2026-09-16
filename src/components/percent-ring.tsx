import { formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PercentRing({
  value,
  safe,
  size = 112,
  label,
}: {
  value: number | null;
  safe: boolean;
  size?: number;
  label?: string;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const color = value === null ? "var(--color-line-strong)" : safe ? "var(--color-safe)" : "var(--color-warn)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span
            className={cn(
              "font-display text-2xl tabular-nums leading-none tracking-tight",
              value === null ? "text-ink-faint" : safe ? "text-safe" : "text-warn",
            )}
          >
            {formatPercent(value)}
          </span>
        </div>
      </div>
      {label ? (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </p>
      ) : null}
    </div>
  );
}
