import { createFileRoute } from "@tanstack/react-router";
import { Github, Mail, Twitter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  getAvatarUrl,
  uploadAvatar,
  removeAvatar,
} from "@/lib/use-profile-avatar";
import { selectActive, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import type { Profile } from "@/lib/rollbook/types";
import { localISODate } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const APP_VERSION = "1.0.0";

function SettingsPage() {
  const user = useCurrentUser();
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const mut = useRollbookMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [semOpen, setSemOpen] = useState(false);
  const profile = snapshot?.profile;

  // ── Avatar state ──────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    setAvatarUrl(user?.id ? getAvatarUrl(user.id) : null);
  }, [user?.id]);

  async function handleAvatarChange(dataUrl: string | null) {
    if (!user?.id) return;
    try {
      if (dataUrl) {
        const newUrl = await uploadAvatar(user.id, dataUrl);
        setAvatarUrl(newUrl);
        toast.success("Profile picture updated.");
      } else {
        await removeAvatar(user.id);
        setAvatarUrl(null);
        toast.success("Profile picture removed.");
      }
      // Notify header + home page
      window.dispatchEvent(new Event("rollbook:avatar-updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save picture.");
    }
  }

  // ── Backup helpers ────────────────────────────────────────────────────────
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

      {/* ── Account ── */}
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

      {/* ── Profile (with avatar) ── */}
      {profile ? (
        <ProfileForm
          key={profile.studentId}
          profile={profile}
          userId={user?.id ?? ""}
          avatarUrl={avatarUrl}
          onAvatarChange={handleAvatarChange}
        />
      ) : null}

      {/* ── Semesters ── */}
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
                    {s.isActive ? (
                      <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                        active
                      </span>
                    ) : null}
                    {s.classesOver ? (
                      <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs text-ink-faint">
                        archived
                      </span>
                    ) : null}
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

      {/* ── Backup ── */}
      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">Backup</h2>
        <p className="text-sm text-ink-soft">
          Your roll already syncs with this email. Export is an extra copy on your device.
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

      {/* ── About ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">About</h2>
        <Card className="mt-3 space-y-4">
          {/* App identity */}
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="Rollbook logo"
              className="size-12 rounded-xl"
            />
            <div>
              <p className="font-semibold text-ink">Rollbook</p>
              <p className="text-xs text-ink-faint">Version {APP_VERSION}</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                College attendance, bunk planner & credit tracker
              </p>
            </div>
          </div>

          <hr className="border-line" />

          {/* Developer */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Developer
            </p>
            <p className="font-medium text-ink">Mritunjay Pandey</p>
            <ul className="mt-2 space-y-2">
              <li>
                <a
                  href="https://x.com/mritunjaylive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <Twitter className="size-4 shrink-0" />
                  @mritunjaylive
                </a>
              </li>
              <li>
                <a
                  href="mailto:mritunjaylive@zohomail.in"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <Mail className="size-4 shrink-0" />
                  mritunjaylive@zohomail.in
                </a>
              </li>
            </ul>
          </div>

          <hr className="border-line" />

          {/* Legal / misc */}
          <p className="text-xs text-ink-faint">
            Built with TanStack Start, React 19, Better Auth, and Neon PostgreSQL.
            Your data is private and scoped to your account only.
          </p>
        </Card>
      </section>

      <NewSemesterDialog open={semOpen} onOpenChange={setSemOpen} />
    </AppShell>
  );
}

// ── Profile form (with editable avatar) ──────────────────────────────────────

function ProfileForm({
  profile,
  userId,
  avatarUrl,
  onAvatarChange,
}: {
  profile: Profile;
  userId: string;
  avatarUrl: string | null;
  onAvatarChange: (dataUrl: string | null) => void;
}) {
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

      {/* Avatar + name side-by-side */}
      <div className="flex items-center gap-4">
        <ProfileAvatar
          src={avatarUrl}
          name={studentName || profile.studentName}
          size={72}
          editable
          onAvatarChange={onAvatarChange}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">
            {studentName || profile.studentName}
          </p>
          <p className="text-xs text-ink-faint">{studentId || profile.studentId}</p>
          <p className="mt-1 text-xs text-ink-faint">
            Tap the photo to upload · max 50 KB
          </p>
        </div>
      </div>

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
        {mut.upsertProfile.isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

// ── New semester dialog ───────────────────────────────────────────────────────

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
