import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ACTIVITY_KINDS } from "@/lib/rollbook/days";
import { useRollbookMutations } from "@/lib/rollbook/queries";
import type { Activity, ActivityKind } from "@/lib/rollbook/types";
import { localISODate } from "@/lib/utils";

function kindLabel(kind: ActivityKind) {
  return ACTIVITY_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

function formatTime(t: string) {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export function ParticipationList({ activities }: { activities: Activity[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Participation</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Workshops, fests, games, and other events you took part in.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>

      {activities.length === 0 ? (
        <Card className="mt-3">
          <p className="text-sm text-ink-soft">
            Nothing recorded yet. Add a workshop, fest, or activity to keep a dated log.
          </p>
        </Card>
      ) : (
        <ul className="mt-3 space-y-2">
          {activities.map((item) => (
            <li key={item.id}>
              <Card className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                      {kindLabel(item.kind)}
                    </p>
                    <p className="mt-0.5 font-medium text-ink">{item.name}</p>
                    <p className="mt-1 text-xs text-ink-faint">
                      {item.activityDate} · {formatTime(item.startTime)} – {formatTime(item.endTime)}
                      {item.credits != null && item.credits > 0
                        ? ` · ${item.credits} credit${item.credits === 1 ? "" : "s"}`
                        : ""}
                    </p>
                    {item.description ? (
                      <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => {
                        setEditing(item);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteActivityButton id={item.id} name={item.name} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ActivityDialog
        open={open}
        onOpenChange={setOpen}
        existing={editing}
      />
    </section>
  );
}

function DeleteActivityButton({ id, name }: { id: string; name: string }) {
  const mut = useRollbookMutations();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={`Delete ${name}`}
      disabled={mut.deleteActivity.isPending}
      onClick={() => {
        void mut.deleteActivity.mutateAsync(id).then(
          () => toast.success("Removed from participation."),
          (err) => toast.error(err instanceof Error ? err.message : "Could not delete."),
        );
      }}
    >
      <Trash2 className="size-4 text-warn" />
    </Button>
  );
}

function ActivityDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: Activity | null;
}) {
  const mut = useRollbookMutations();
  const [kind, setKind] = useState<ActivityKind>("workshop");
  const [name, setName] = useState("");
  const [activityDate, setActivityDate] = useState(localISODate());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [description, setDescription] = useState("");
  const [credits, setCredits] = useState("");

  const title = existing ? "Edit participation" : "Add participation";

  useEffect(() => {
    if (!open) return;
    setKind(existing?.kind ?? "workshop");
    setName(existing?.name ?? "");
    setActivityDate(existing?.activityDate ?? localISODate());
    setStartTime(formatTime(existing?.startTime ?? "09:00"));
    setEndTime(formatTime(existing?.endTime ?? "11:00"));
    setDescription(existing?.description ?? "");
    setCredits(
      existing?.credits != null && existing.credits > 0 ? String(existing.credits) : "",
    );
  }, [open, existing]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
    >
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsedCredits = credits.trim() === "" ? null : Number(credits);
          try {
            await mut.upsertActivity.mutateAsync({
              id: existing?.id,
              kind,
              name,
              activityDate,
              startTime,
              endTime,
              description,
              credits:
                parsedCredits == null || Number.isNaN(parsedCredits) ? null : parsedCredits,
            });
            onOpenChange(false);
            toast.success(existing ? "Participation updated." : "Participation added.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save.");
          }
        }}
      >
        <Field label="Type">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as ActivityKind)}
          >
            {ACTIVITY_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name of activity">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Annual tech fest"
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </Field>
          <Field label="To">
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you did, role, or outcome"
          />
        </Field>
        <Field label="Credits (optional)">
          <Input
            type="number"
            min={0}
            max={999}
            inputMode="numeric"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="Leave blank if none"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={mut.upsertActivity.isPending}>
          {mut.upsertActivity.isPending ? "Saving…" : existing ? "Save changes" : "Add"}
        </Button>
      </form>
    </Dialog>
  );
}
