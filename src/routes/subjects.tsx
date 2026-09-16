import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatsLine } from "@/components/stats-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { statsForSubject } from "@/lib/rollbook/derive";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";

export const Route = createFileRoute("/subjects")({ component: SubjectsPage });

function SubjectsPage() {
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const threshold = snapshot?.profile?.thresholdPercent ?? 75;
  const [open, setOpen] = useState(false);
  const mut = useRollbookMutations();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teacher, setTeacher] = useState("");

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Subjects</h1>
          <p className="text-sm text-ink-soft">Percentage and credit for each paper.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!active.semester}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {active.subjects.length === 0 ? (
        <p className="mt-6 text-ink-soft">No subjects yet. Add the papers you attend.</p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {active.subjects.map((s) => {
            const st = snapshot ? statsForSubject(snapshot, s.id, threshold) : null;
            return (
              <li key={s.id}>
                <Link to="/subjects/$subjectId" params={{ subjectId: s.id }} className="block">
                  <Card>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-ink-faint">
                          {[s.code, s.defaultTeacher].filter(Boolean).join(" · ") || "Paper"}
                          {s.closed ? " · closed" : ""}
                        </p>
                      </div>
                    </div>
                    {st ? (
                      <div className="mt-3">
                        <StatsLine stats={st} compact />
                      </div>
                    ) : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen} title="Add subject">
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
              setOpen(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add subject.");
            }
          }}
        >
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Teacher">
            <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={mut.upsertSubject.isPending}>
            Save
          </Button>
        </form>
      </Dialog>
    </AppShell>
  );
}
