import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import type { Profile } from "@/lib/rollbook/types";
import { localISODate } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const user = useCurrentUser();
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const mut = useRollbookMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [semOpen, setSemOpen] = useState(false);
  const profile = snapshot?.profile;

  function exportJson() {
    if (!snapshot) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1 as const,
            profile: snapshot.profile,
            semesters: snapshot.semesters,
            subjects: snapshot.subjects,
            periods: snapshot.periods,
            attendance: snapshot.attendance,
            credits: snapshot.credits,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rollbook-backup-${localISODate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Parameters<
        typeof mut.importSnapshot.mutateAsync
      >[0];
      await mut.importSnapshot.mutateAsync(parsed);
      toast.success("Backup restored.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import that file.");
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">More</h1>

      <Card className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Account
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {user?.primaryEmail ?? user?.displayName}
        </p>
        <div className="mt-3">
          <UserButton />
        </div>
      </Card>

      {profile ? <ProfileForm key={profile.studentId} profile={profile} /> : null}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Semesters</h2>
          <Button size="sm" variant="secondary" onClick={() => setSemOpen(true)}>
            New
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {snapshot?.semesters.map((s) => (
            <li key={s.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">
                    {s.semesterName}
                    {s.isActive ? " · active" : ""}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {s.courseName}
                    {s.startDate ? ` · started ${s.startDate}` : ""}
                  </p>
                </div>
                {!s.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void mut.setActiveSemester.mutateAsync(s.id)}
                  >
                    Switch
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
        {active.semester ? (
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={active.semester.classesOver}
              onChange={(e) =>
                void mut.setSemesterClassesOver.mutateAsync({
                  id: active.semester!.id,
                  classesOver: e.target.checked,
                })
              }
            />
            No more classes this semester
          </label>
        ) : null}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">Backup</h2>
        <p className="text-sm text-ink-soft">
          Your roll already syncs with this email. Export is an extra copy on your
          device.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportJson}>
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <NewSemesterDialog open={semOpen} onOpenChange={setSemOpen} />
    </AppShell>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const mut = useRollbookMutations();
  const [studentName, setStudentName] = useState(profile.studentName);
  const [studentId, setStudentId] = useState(profile.studentId);
  const [collegeName, setCollegeName] = useState(profile.collegeName);
  const [threshold, setThreshold] = useState(profile.thresholdPercent);

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await mut.upsertProfile.mutateAsync({
            studentName,
            studentId,
            collegeName,
            thresholdPercent: threshold,
          });
          toast.success("Profile saved.");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save.");
        }
      }}
    >
      <h2 className="font-display text-xl font-semibold">Profile</h2>
      <Field label="Student name">
        <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
      </Field>
      <Field label="Student ID">
        <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
      </Field>
      <Field label="College">
        <Input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} required />
      </Field>
      <Field label="Attendance threshold (%)">
        <Input
          type="number"
          min={50}
          max={100}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value) || 75)}
        />
      </Field>
      <Button type="submit" disabled={mut.upsertProfile.isPending}>
        Save profile
      </Button>
    </form>
  );
}

function NewSemesterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [courseName, setCourseName] = useState("");
  const [semesterName, setSemesterName] = useState("");
  const [startDate, setStartDate] = useState(localISODate());

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New semester">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await mut.upsertSemester.mutateAsync({
            courseName,
            semesterName,
            startDate,
            makeActive: true,
          });
          setCourseName("");
          setSemesterName("");
          onOpenChange(false);
          toast.success("Semester created.");
        }}
      >
        <Field label="Course">
          <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
        </Field>
        <Field label="Semester">
          <Input value={semesterName} onChange={(e) => setSemesterName(e.target.value)} required />
        </Field>
        <Field label="Started on">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full">
          Create and switch
        </Button>
      </form>
    </Dialog>
  );
}
