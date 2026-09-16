import { Ban, Check, Sun, X } from "lucide-react";
import type { AttendanceStatus } from "@/lib/rollbook/types";
import { cn } from "@/lib/utils";

const OPTIONS: {
  status: AttendanceStatus;
  label: string;
  hint: string;
  Icon: typeof Check;
  active: string;
}[] = [
  {
    status: "present",
    label: "Present",
    hint: "Counts",
    Icon: Check,
    active: "bg-safe text-accent-fg border-safe",
  },
  {
    status: "absent",
    label: "Absent",
    hint: "Counts",
    Icon: X,
    active: "bg-warn text-accent-fg border-warn",
  },
  {
    status: "holiday",
    label: "Holiday",
    hint: "Skipped",
    Icon: Sun,
    active: "bg-ink text-accent-fg border-ink",
  },
  {
    status: "cancelled",
    label: "Not held",
    hint: "Skipped",
    Icon: Ban,
    active: "bg-ink-soft text-accent-fg border-ink-soft",
  },
];

export function MarkPad({
  value,
  onChange,
  disabled,
}: {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((opt) => {
        const on = value === opt.status;
        return (
          <button
            key={opt.status}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.status)}
            className={cn(
              "flex min-h-12 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors duration-150",
              on
                ? opt.active
                : "border-line bg-paper text-ink hover:border-line-strong",
              disabled && "opacity-50",
            )}
          >
            <opt.Icon className="size-4 shrink-0" strokeWidth={2.2} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-none">
                {opt.label}
              </span>
              <span className={cn("mt-0.5 block text-[11px]", on ? "opacity-80" : "text-ink-faint")}>
                {opt.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
