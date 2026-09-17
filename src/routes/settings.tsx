import { createFileRoute } from "@tanstack/react-router";
import { Bell, Calendar, Github, Linkedin, Mail, Pencil, Plus, Trash2, Twitter } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ParticipationList } from "@/components/participation-list";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
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

const APP_VERSION = "1.3.0";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

function SettingsPage() {
  const user = useCurrentUser();
  const snap = useSnapshot();
  const snapshot = snap.data;
  const active = selectActive(snapshot);
  const mut = useRollbookMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [semOpen, setSemOpen] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const profile = snapshot?.profile;

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
      window.dispatchEvent(new Event("rollbook:avatar-updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save picture.");
    }
  }

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
            activities: snapshot.activities,
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

  const accountName = profile?.studentName || user?.displayName || user?.primaryEmail || "Account";

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">More</h1>

      <Card className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Account
        </p>
        <div className="mt-3 flex items-start gap-3">
          <ProfileAvatar
            src={avatarUrl}
            name={accountName}
            size={56}
            editable={editingProfile}
            onAvatarChange={handleAvatarChange}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{accountName}</p>
            {user?.primaryEmail && user.primaryEmail !== accountName ? (
              <p className="truncate text-sm text-ink-soft">{user.primaryEmail}</p>
            ) : null}
            {editingProfile ? (
              <p className="mt-1 text-xs text-ink-faint">Tap the photo to change · max 50 KB</p>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </Card>

      {profile ? (
        <ProfileCard
          key={profile.studentId}
          profile={profile}
          editing={editingProfile}
          onEditingChange={setEditingProfile}
        />
      ) : null}

      <ParticipationList activities={snapshot?.activities ?? []} />

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Holiday & Exam Mode</h2>
          <Button size="sm" variant="secondary" onClick={() => setHolidayOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add
          </Button>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          Pause routine notifications during breaks or exams.
        </p>
        <ul className="mt-3 space-y-2">
          {!snapshot?.holidays?.length ? (
            <p className="text-sm text-ink-faint">No upcoming holidays scheduled.</p>
          ) : (
            snapshot?.holidays.map((h) => (
              <li key={h.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium text-ink">{h.name}</p>
                    <p className="text-xs text-ink-faint">
                      {h.startDate} to {h.endDate}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-warn hover:bg-warn-soft"
                    onClick={async () => {
                      if (confirm("Delete this holiday?")) {
                        await mut.deleteHoliday.mutateAsync(h.id);
                        toast.success("Holiday deleted");
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </Card>
              </li>
            ))
          )}
        </ul>
      </section>

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

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">Notifications</h2>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Daily Class Summaries & Alerts</p>
              <p className="text-sm text-ink-soft">
                Get morning updates and threshold alerts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!("Notification" in window) || !("serviceWorker" in navigator)) {
                  toast.error("Push notifications not supported in this browser.");
                  return;
                }
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                  toast.error("Notification permission denied.");
                  return;
                }
                try {
                  const registration = await navigator.serviceWorker.ready;
                  let subscription = await registration.pushManager.getSubscription();
                  if (!subscription) {
                    const response = await fetch("/api/vapid-public-key");
                    if (!response.ok) throw new Error("Could not get VAPID key");
                    const { publicKey } = await response.json();
                    subscription = await registration.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: publicKey,
                    });
                  }
                  
                  await fetch("/api/push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(subscription),
                  });
                  toast.success("Notifications enabled.");
                } catch (e) {
                  toast.error("Error setting up notifications.");
                }
              }}
            >
              <Bell className="mr-2 size-4" />
              Enable
            </Button>
          </div>
        </Card>
      </section>

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

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">About</h2>
        <Card className="mt-3 space-y-4">
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
                  href="https://github.com/mritunjaylive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <Github className="size-4 shrink-0" />
                  @mritunjaylive
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/in/mritunjaylive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <Linkedin className="size-4 shrink-0" />
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

          <p className="text-xs text-ink-faint">
            Built with TanStack Start, React 19, Better Auth, and Neon PostgreSQL.
            Your data is private and scoped to your account only.
          </p>
        </Card>
      </section>

      <NewSemesterDialog open={semOpen} onOpenChange={setSemOpen} />
      <NewHolidayDialog open={holidayOpen} onOpenChange={setHolidayOpen} />
    </AppShell>
  );
}

function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );
  if (!authEnabled || gateSession) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      className="mt-3"
      disabled={signingOut}
      onClick={() => {
        setSigningOut(true);
        void signOut().catch(() => setSigningOut(false));
      }}
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </Button>
  );
}

function ProfileCard({
  profile,
  editing,
  onEditingChange,
}: {
  profile: Profile;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [studentName, setStudentName] = useState(profile.studentName);
  const [studentId, setStudentId] = useState(profile.studentId);
  const [collegeName, setCollegeName] = useState(profile.collegeName);
  const [threshold, setThreshold] = useState(profile.thresholdPercent);

  function cancelEdit() {
    setStudentName(profile.studentName);
    setStudentId(profile.studentId);
    setCollegeName(profile.collegeName);
    setThreshold(profile.thresholdPercent);
    onEditingChange(false);
  }

  return (
    <Card className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Profile
        </p>
        {editing ? (
          <Button size="sm" variant="ghost" type="button" onClick={cancelEdit}>
            Cancel
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => onEditingChange(true)}
          >
            <Pencil className="size-4" aria-hidden />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <form
          className="mt-4 space-y-3"
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
              onEditingChange(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not save.");
            }
          }}
        >
          <Field label="Student name">
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
          </Field>
          <Field label="College">
            <Input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} required />
          </Field>
          <Field label="Student ID">
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
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
      ) : (
        <dl className="mt-4 grid gap-3">
          <ReadRow label="Student name" value={profile.studentName} />
          <ReadRow label="College" value={profile.collegeName} />
          <ReadRow label="Student ID" value={profile.studentId} />
          <ReadRow
            label="Attendance threshold"
            value={`${profile.thresholdPercent}%`}
          />
        </dl>
      )}
    </Card>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
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

function NewHolidayDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(localISODate());
  const [endDate, setEndDate] = useState(localISODate());

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New break or exam">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (startDate > endDate) {
            toast.error("End date cannot be before start date.");
            return;
          }
          await mut.upsertHoliday.mutateAsync({
            name,
            startDate,
            endDate,
          });
          setName("");
          setStartDate(localISODate());
          setEndDate(localISODate());
          onOpenChange(false);
          toast.success("Holiday created.");
        }}
      >
        <Field label="Description">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Mid-sem break" />
        </Field>
        <Field label="Start date">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="End date">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full">
          Save holiday
        </Button>
      </form>
    </Dialog>
  );
}
