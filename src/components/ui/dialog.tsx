import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-3 top-[8%] z-50 mx-auto max-h-[84dvh] overflow-y-auto rounded-[var(--radius-xl)] bg-page p-5 shadow-[var(--shadow-card)] focus:outline-none sm:inset-x-auto sm:top-[10%] sm:left-1/2 sm:-translate-x-1/2",
            wide ? "sm:w-[min(640px,calc(100vw-2rem))]" : "sm:w-[min(440px,calc(100vw-2rem))]",
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <DialogPrimitive.Title className="font-display text-xl font-semibold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-ink-soft hover:bg-line/70">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
