import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { CreditForm } from "@/components/credit-form";
import { PercentRing } from "@/components/percent-ring";
import { StatsLine } from "@/components/stats-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { CREDIT_TYPES } from "@/lib/rollbook/days";
import { statsForSubject } from "@/lib/rollbook/derive";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
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

  if (!snapshot || !subject) {
    return (
      <AppShell>
        <p className="text-ink-soft">Subject not found.</p>
        <Link to="/subjects" className="mt-3 inline-block text-sm font-medium text-accent">
          Back
        </Link>
      </AppShell>
    );
  }

  const stats = statsForSubject(snapshot, subject.id, threshold);
  const credits = snapshot.credits.filter((c) => c.subjectId === subject.id);
  const periodIds = new Set(
    snapshot.periods.filter((p) => p.subjectId === subject.id).map((p) => p.id),
  );
  const history = snapshot.attendance
    .filter((a) => periodIds.has(a.periodId))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const noMore = subject.closed || Boolean(active.semester?.classesOver);

  return (
    <AppShell>
      <Link to="/subjects" className="text-sm font-medium text-accent">
        All subjects
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{subject.name}</h1>
          <p className="text-sm text-ink-soft">
            {[subject.code, subject.defaultTeacher].filter(Boolean).join(" · ") || "Paper"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button onClick={() => setCreditOpen(true)}>Add credit</Button>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <PercentRing value={stats.rawPercent} safe={stats.creditNeeded === 0} label="This paper" />
        <StatsLine stats={stats} />
      </section>

      {noMore && stats.creditNeeded > 0 ? (
        <p className="mt-4 rounded-[var(--radius-md)] bg-warn-soft px-3 py-2 text-sm text-warn">
          No more classes for this paper. Credit {stats.creditNeeded} must come from the teacher
          (notes, assignment, or project).
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
                    className="text-sm text-warn"
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
                <span className="capitalize">
                  {h.status === "cancelled" ? "not held" : h.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="mt-10 text-sm text-warn"
        onClick={async () => {
          if (!confirm("Delete this subject and its marks?")) return;
          await mut.deleteSubject.mutateAsync(subject.id);
          toast.success("Subject removed.");
          void navigate({ to: "/subjects" });
        }}
      >
        Delete subject
      </button>

      <Dialog open={creditOpen} onOpenChange={setCreditOpen} title="Add teacher credit">
        <p className="mb-3 text-sm text-ink-soft">
          Use this after the teacher accepts notes, an assignment, or a project as makeup.
        </p>
        <CreditForm
          subject={subject}
          busy={mut.addCreditGrant.isPending}
          onSubmit={async (data) => {
            try {
              await mut.addCreditGrant.mutateAsync({
                subjectId: subject.id,
                ...data,
              });
              setCreditOpen(false);
              toast.success("Credit added.");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not add credit.");
            }
          }}
        />
      </Dialog>

      <EditSubjectDialog open={editOpen} onOpenChange={setEditOpen} subject={subject} />
    </AppShell>
  );
}

function EditSubjectDialog({
  open,
  onOpenChange,
  subject,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject: {
    id: string;
    semesterId: string;
    name: string;
    code: string | null;
    defaultTeacher: string | null;
  };
}) {
  const mut = useRollbookMutations();
  const [name, setName] = useState(subject.name);
  const [code, setCode] = useState(subject.code ?? "");
  const [teacher, setTeacher] = useState(subject.defaultTeacher ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit subject">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await mut.upsertSubject.mutateAsync({
            id: subject.id,
            semesterId: subject.semesterId,
            name,
            code: code || null,
            defaultTeacher: teacher || null,
          });
          onOpenChange(false);
        }}
      >
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Code">
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="Teacher">
          <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full">
          Save
        </Button>
      </form>
    </Dialog>
  );
}
