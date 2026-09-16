import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import { localISODate } from "@/lib/utils";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const snap = useSnapshot();
  const profile = snap.data?.profile;
  const active = selectActive(snap.data);
  const [step, setStep] = useState(profile ? (active.semester ? 2 : 1) : 0);

  if (profile && active.semester && step > 2) {
    return <Navigate to="/" />;
  }

  return (
    <AppShell nav={false}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Step {Math.min(step, 2) + 1} of 3
      </p>
      {step === 0 ? (
        <ProfileStep onDone={() => setStep(1)} />
      ) : step === 1 ? (
        <SemesterStep onDone={() => setStep(2)} />
      ) : (
        <SubjectsStep
          onDone={() => {
            toast.success("Rollbook is ready.");
          }}
        />
      )}
    </AppShell>
  );
}

function ProfileStep({ onDone }: { onDone: () => void }) {
  const user = useCurrentUser();
  const { upsertProfile } = useRollbookMutations();
  const existing = useSnapshot().data?.profile;
  const [studentName, setStudentName] = useState(
    existing?.studentName ?? user?.displayName ?? "",
  );
  const [studentId, setStudentId] = useState(existing?.studentId ?? "");
  const [collegeName, setCollegeName] = useState(existing?.collegeName ?? "");

  return (
    <form
      className="mt-4 max-w-md space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await upsertProfile.mutateAsync({ studentName, studentId, collegeName });
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save profile.");
        }
      }}
    >
      <h1 className="font-display text-3xl font-semibold">Your profile</h1>
      <p className="text-ink-soft">Used on every attendance sheet. You can edit this later.</p>
      <Field label="Student name">
        <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
      </Field>
      <Field label="Student ID">
        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
      </Field>
      <Field label="College">
        <Input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" disabled={upsertProfile.isPending}>
        Continue
      </Button>
    </form>
  );
}

function SemesterStep({ onDone }: { onDone: () => void }) {
  const { upsertSemester } = useRollbookMutations();
  const existing = selectActive(useSnapshot().data).semester;
  const [courseName, setCourseName] = useState(existing?.courseName ?? "");
  const [semesterName, setSemesterName] = useState(existing?.semesterName ?? "");
  const [startDate, setStartDate] = useState(existing?.startDate ?? localISODate());

  return (
    <form
      className="mt-4 max-w-md space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await upsertSemester.mutateAsync({
            id: existing?.id,
            courseName,
            semesterName,
            startDate,
            makeActive: true,
          });
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save semester.");
        }
      }}
    >
      <h1 className="font-display text-3xl font-semibold">Course and semester</h1>
      <p className="text-ink-soft">
        Only the start date is needed. Flip “no more classes” when the paper actually ends.
      </p>
      <Field label="Course">
        <Input
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="B.Tech Computer Science"
          required
        />
      </Field>
      <Field label="Semester">
        <Input
          value={semesterName}
          onChange={(e) => setSemesterName(e.target.value)}
          placeholder="Semester 5"
          required
        />
      </Field>
      <Field label="Started on">
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" disabled={upsertSemester.isPending}>
        Continue
      </Button>
    </form>
  );
}

function SubjectsStep({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const snap = useSnapshot();
  const active = selectActive(snap.data);
  const { upsertSubject } = useRollbookMutations();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [teacher, setTeacher] = useState("");

  const subjects = active.subjects;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!active.semester) return;
    try {
      await upsertSubject.mutateAsync({
        semesterId: active.semester.id,
        name,
        code: code || null,
        defaultTeacher: teacher || null,
      });
      setName("");
      setCode("");
      setTeacher("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add subject.");
    }
  }

  return (
    <div className="mt-4 max-w-md">
      <h1 className="font-display text-3xl font-semibold">Subjects</h1>
      <p className="text-ink-soft">Add the papers you sit this semester. You can add more later.</p>
      <ul className="mt-4 space-y-2">
        {subjects.map((s) => (
          <li
            key={s.id}
            className="rounded-[var(--radius-md)] bg-page px-3 py-2 shadow-[var(--shadow-card)]"
          >
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-ink-faint">
              {[s.code, s.defaultTeacher].filter(Boolean).join(" · ") || "No code yet"}
            </p>
          </li>
        ))}
      </ul>
      <form className="mt-4 space-y-3" onSubmit={add}>
        <Field label="Subject name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CS301" />
          </Field>
          <Field label="Teacher">
            <Input value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" className="w-full" disabled={upsertSubject.isPending}>
          Add subject
        </Button>
      </form>
      <Button
        className="mt-4 w-full"
        onClick={() => {
          onDone();
          void navigate({ to: "/" });
        }}
      >
        {subjects.length ? "Go to Today" : "Skip for now"}
      </Button>
    </div>
  );
}
