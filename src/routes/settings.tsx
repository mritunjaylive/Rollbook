import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  Bell,
  Camera,
  Github,
  Globe,
  Linkedin,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
  Printer,
  Twitter,
  Mail,
  Calendar,
  Laptop,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ParticipationList } from "@/components/participation-list";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { authEnabled, signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  getAvatarUrl,
  uploadAvatar,
  removeAvatar,
} from "@/lib/use-profile-avatar";
import { selectActive, selectActiveTerm, useRollbookMutations, useSnapshot } from "@/lib/rollbook/queries";
import { isValidSession } from "@/lib/rollbook/api";
import type { Profile, Semester, Term } from "@/lib/rollbook/types";
import { localISODate } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

const APP_VERSION = "2.1.0";

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
  const [termOpen, setTermOpen] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [moveRoutineTarget, setMoveRoutineTarget] = useState<Semester | null>(null);
  const [renamingTerm, setRenamingTerm] = useState<Term | null>(null);
  const [renamingRoutine, setRenamingRoutine] = useState<Semester | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const profile = snapshot?.profile;
  const activeTerm = selectActiveTerm(snapshot);

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

  async function exportJson() {
    try {
      const fullSnapshot = await mut.getFullBackup.mutateAsync();
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: 1 as const,
              profile: fullSnapshot.profile,
              terms: fullSnapshot.terms,
              semesters: fullSnapshot.semesters,
              subjects: fullSnapshot.subjects,
              periods: fullSnapshot.periods,
              attendance: fullSnapshot.attendance,
              credits: fullSnapshot.credits,
              activities: fullSnapshot.activities,
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export backup.");
    }
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
          <h2 className="font-display text-xl font-semibold">Semesters &amp; Routines</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setTermOpen(true)}>
              New Term
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSemOpen(true)}>
              New Routine
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          A <strong>Term</strong> is the academic semester grouping (e.g. &ldquo;Odd Semester 2025-26&rdquo;).
          A <strong>Routine</strong> is a concrete timetable inside a term — use &ldquo;Archive &amp; start fresh&rdquo; to roll over to a new routine within the same term.
        </p>

        {/* Term list */}
        {snapshot?.terms && snapshot.terms.length > 0 ? (
          <ul className="mt-3 space-y-4">
            {snapshot.terms.map((term) => {
              const termRoutines = snapshot.semesters.filter((s) => s.termId === term.id);
              return (
                <li key={term.id}>
                  <Card className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink">
                          {term.name}
                          {term.isActive ? (
                            <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                              active
                            </span>
                          ) : null}
                          {term.classesOver ? (
                            <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-xs text-ink-faint">
                              ended
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Rename semester"
                          onClick={() => setRenamingTerm(term)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        {!term.isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void mut.setActiveTerm.mutateAsync(term.id).catch((err) => toast.error(err instanceof Error ? err.message : "Could not switch semester."))}
                          >
                            Switch
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-warn hover:bg-warn-soft"
                          title="Delete semester"
                          onClick={async () => {
                            if (termRoutines.length > 0) {
                              if (
                                confirm(
                                  `This semester contains ${termRoutines.length} routine(s) (${termRoutines.map((r) => r.semesterName).join(", ")}). Deleting this semester will permanently delete all its routines, subjects, and attendance. Are you sure?`,
                                )
                              ) {
                                await mut.deleteTerm.mutateAsync({ id: term.id, deleteRoutines: true });
                                toast.success("Semester deleted.");
                              }
                            } else {
                              if (confirm(`Delete semester "${term.name}"?`)) {
                                await mut.deleteTerm.mutateAsync({ id: term.id });
                                toast.success("Semester deleted.");
                              }
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {termRoutines.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-t border-line pt-3">
                        {termRoutines.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-ink">
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
                                {s.courseName}{s.startDate ? ` · started ${s.startDate}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Rename routine"
                                onClick={() => setRenamingRoutine(s)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              {!s.isActive ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void mut.setActiveSemester.mutateAsync(s.id)}
                                >
                                  Switch
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Move to another semester"
                                onClick={() => setMoveRoutineTarget(s)}
                              >
                                <ArrowRightLeft className="mr-1 size-3.5" />
                                Move
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-warn hover:bg-warn-soft"
                                title="Delete routine"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `Delete routine "${s.semesterName}"? All its periods and attendance records will be removed.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  try {
                                    await mut.deleteSemester.mutateAsync(s.id);
                                    toast.success("Routine deleted.");
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Could not delete routine.");
                                  }
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : null}

        {/* Unlinked routines (legacy rows without a term) */}
        {snapshot?.semesters.filter((s) => !s.termId).length ? (
          <>
            {snapshot.terms.length > 0 ? (
              <p className="mt-3 text-xs text-ink-faint">Routines not linked to a semester:</p>
            ) : null}
            <ul className="mt-2 space-y-2">
              {snapshot.semesters
                .filter((s) => !s.termId)
                .map((s) => (
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
                          {s.courseName}{s.startDate ? ` · started ${s.startDate}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!s.isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void mut.setActiveSemester.mutateAsync(s.id)}
                          >
                            Switch
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setMoveRoutineTarget(s)}
                        >
                          <ArrowRightLeft className="mr-1 size-3.5" />
                          Attach to semester
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-warn hover:bg-warn-soft"
                          title="Delete routine"
                          onClick={async () => {
                            if (
                              confirm(
                                `Delete routine "${s.semesterName}"? All its periods and attendance records will be removed.`,
                              )
                            ) {
                              await mut.deleteSemester.mutateAsync(s.id);
                              toast.success("Routine deleted.");
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
            </ul>
          </>
        ) : null}

        {active.term ? (
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={active.term.classesOver}
              onChange={(e) =>
                void mut.setTermClassesOver.mutateAsync({
                  id: active.term!.id,
                  classesOver: e.target.checked,
                })
              }
            />
            No more classes this semester
          </label>
        ) : active.semester ? (
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
        <h2 className="font-display text-xl font-semibold">Appearance</h2>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint mb-3">
            Theme
          </p>
          <ThemeToggle />
        </Card>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="font-display text-xl font-semibold">Backup</h2>
        <p className="text-sm text-ink-soft">
          Your roll already syncs with this email. Export is an extra copy on your device.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void exportJson()}>
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <Button variant="outline" onClick={() => window.open('/report', '_blank')} className="gap-2">
            <Printer className="size-4" />
            PDF Report
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
                  href="https://mritunjaylive.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <Globe className="size-4 shrink-0" />
                  mritunjaylive.in
                </a>
              </li>
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
                  href="mailto:mritunjay@mritunjaylive.in"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                >
                  <Mail className="size-4 shrink-0" />
                  mritunjay@mritunjaylive.in
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

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Contact Us</h2>
        <Card className="mt-3 space-y-4">
          <p className="text-sm text-ink-soft">
            Have questions, feedback, or need help? Send us an email directly or use the form below.
          </p>
          <a
            href="mailto:rollbook@mritunjaylive.in"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
          >
            <Mail className="size-4 shrink-0" />
            rollbook@mritunjaylive.in
          </a>

          <hr className="border-line" />

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const subject = (form.elements.namedItem("subject") as HTMLInputElement).value;
              const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value;
              window.location.href = `mailto:rollbook@mritunjaylive.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
            }}
          >
            <Field label="Subject">
              <Input name="subject" required placeholder="e.g. Bug report or Feature request" />
            </Field>
            <Field label="Message">
              <textarea
                name="message"
                required
                rows={4}
                className="flex w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="How can we help you?"
              />
            </Field>
            <Button type="submit">Open Email Client</Button>
          </form>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-warn">Danger Zone</h2>
        <Card className="mt-3 space-y-4 border-warn/20">
          {!profile?.scheduledDeletionDate ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-warn">Delete Account</p>
                <p className="text-sm text-ink-soft mt-1">
                  Permanently remove your account and all associated data.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 text-warn border-warn/30 hover:bg-warn/10"
                onClick={() => setDeleteAccountOpen(true)}
              >
                Delete Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-warn">
                Account scheduled for deletion on {new Date(profile.scheduledDeletionDate).toLocaleDateString()}
              </p>
              <p className="text-sm text-ink-soft">
                Your account is currently in the 7-day grace period.
              </p>
              <Button
                variant="outline"
                className="w-full text-warn border-warn/30 hover:bg-warn/10"
                onClick={async () => {
                  await mut.cancelAccountDeletion.mutateAsync();
                }}
              >
                Cancel Deletion & Keep Account
              </Button>
            </div>
          )}
        </Card>
      </section>

      <NewTermDialog open={termOpen} onOpenChange={setTermOpen} />
      <NewSemesterDialog open={semOpen} onOpenChange={setSemOpen} snapshot={snapshot} />
      <NewHolidayDialog open={holidayOpen} onOpenChange={setHolidayOpen} />
      <DeleteAccountDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />
      <MoveRoutineDialog
        routine={moveRoutineTarget}
        terms={snapshot?.terms ?? []}
        open={Boolean(moveRoutineTarget)}
        onOpenChange={(v) => !v && setMoveRoutineTarget(null)}
      />
      <RenameTermDialog
        term={renamingTerm}
        open={Boolean(renamingTerm)}
        onOpenChange={(v) => !v && setRenamingTerm(null)}
      />
      <RenameRoutineDialog
        routine={renamingRoutine}
        open={Boolean(renamingRoutine)}
        onOpenChange={(v) => !v && setRenamingRoutine(null)}
      />
    </AppShell>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [password, setPassword] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Confirm Deletion">
      <div className="space-y-4">
        <div className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
          <p className="font-semibold">Are you absolutely sure?</p>
          <p className="mt-1">
            This action will initiate the deletion of your account, timetable, and attendance records. You will have a 7-day recovery grace period before permanent deletion.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await mut.requestAccountDeletion.mutateAsync(password);
              window.location.href = "/login";
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Incorrect password. Deletion cancelled.");
            }
          }}
        >
          <Field label="Confirm with your password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </Field>
          <Button type="submit" variant="outline" className="w-full text-white bg-warn hover:bg-warn/90 border-0">
            Confirm & Delete
          </Button>
        </form>
      </div>
    </Dialog>
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
  const [session, setSession] = useState(profile.session ?? "");

  function cancelEdit() {
    setStudentName(profile.studentName);
    setStudentId(profile.studentId);
    setCollegeName(profile.collegeName);
    setThreshold(profile.thresholdPercent);
    setSession(profile.session ?? "");
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
            const trimmedSession = session.trim();
            if (trimmedSession && !isValidSession(trimmedSession)) {
              toast.error("Session must be in format YYYY-YYYY or YYYY-YY (e.g. 2025-2027 or 2025-26).");
              return;
            }
            try {
              await mut.upsertProfile.mutateAsync({
                studentName,
                studentId,
                collegeName,
                thresholdPercent: threshold,
                session: trimmedSession || null,
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
          <Field label="Academic session / year">
            <Input
              value={session}
              onChange={(e) => setSession(e.target.value)}
              placeholder="2025-2027"
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
          {profile.session ? (
            <ReadRow label="Session" value={profile.session} />
          ) : null}
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

function NewTermDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(localISODate());

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New semester">
      <p className="text-sm text-ink-soft">
        A semester groups one or more routines (timetables), e.g. &ldquo;Odd Semester 2025-26&rdquo;.
      </p>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await mut.upsertTerm.mutateAsync({
            name,
            startDate,
            makeActive: true,
          });
          setName("");
          onOpenChange(false);
          toast.success("Semester created and set as active.");
        }}
      >
        <Field label="Semester name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Odd Semester 2025-26"
          />
        </Field>
        <Field label="Started on">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full">
          Create semester
        </Button>
      </form>
    </Dialog>
  );
}

function MoveRoutineDialog({
  routine,
  terms,
  open,
  onOpenChange,
}: {
  routine: Semester | null;
  terms: Term[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [targetTermId, setTargetTermId] = useState<string>("");

  useEffect(() => {
    if (routine) {
      setTargetTermId(routine.termId ?? "unlinked");
    }
  }, [routine]);

  if (!routine) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Move routine">
      <p className="text-sm text-ink-soft">
        Move routine <strong>{routine.semesterName}</strong> to another semester:
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const termId = targetTermId === "unlinked" ? null : targetTermId;
          await mut.moveRoutineToTerm.mutateAsync({
            routineId: routine.id,
            termId,
          });
          toast.success("Routine moved successfully.");
          onOpenChange(false);
        }}
      >
        <Field label="Target semester">
          <Select
            value={targetTermId}
            onChange={(e) => setTargetTermId(e.target.value)}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isActive ? "(active)" : ""}
              </option>
            ))}
            <option value="unlinked">None (unlinked)</option>
          </Select>
        </Field>
        <Button type="submit" className="w-full">
          Move routine
        </Button>
      </form>
    </Dialog>
  );
}

function NewSemesterDialog({
  open,
  onOpenChange,
  snapshot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  snapshot: Parameters<typeof selectActiveTerm>[0];
}) {
  const mut = useRollbookMutations();
  const activeTerm = selectActiveTerm(snapshot);
  const [courseName, setCourseName] = useState("");
  const [semesterName, setSemesterName] = useState("");
  const [startDate, setStartDate] = useState(localISODate());

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New routine">
      {activeTerm ? (
        <p className="text-sm text-ink-soft">
          This routine will be linked to the active term: <strong>{activeTerm.name}</strong>.
        </p>
      ) : (
        <p className="text-sm text-ink-soft">
          No active term — this routine will be unlinked. Create a term first if you want term-wide reporting.
        </p>
      )}
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await mut.upsertSemester.mutateAsync({
            courseName,
            semesterName,
            startDate,
            makeActive: true,
            termId: activeTerm?.id ?? null,
          });
          setCourseName("");
          setSemesterName("");
          onOpenChange(false);
          toast.success("Routine created.");
        }}
      >
        <Field label="Course">
          <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
        </Field>
        <Field label="Routine / Semester label">
          <Input value={semesterName} onChange={(e) => setSemesterName(e.target.value)} required placeholder="e.g. Routine 1" />
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

function RenameTermDialog({
  term,
  open,
  onOpenChange,
}: {
  term: Term | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [name, setName] = useState("");

  useEffect(() => {
    if (term) setName(term.name);
  }, [term]);

  if (!term) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Rename semester">
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await mut.upsertTerm.mutateAsync({ id: term.id, name });
            toast.success("Semester renamed.");
            onOpenChange(false);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not rename.");
          }
        }}
      >
        <Field label="Semester name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Odd Semester 2025-26"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={mut.upsertTerm.isPending}>
          {mut.upsertTerm.isPending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Dialog>
  );
}

function RenameRoutineDialog({
  routine,
  open,
  onOpenChange,
}: {
  routine: Semester | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mut = useRollbookMutations();
  const [semesterName, setSemesterName] = useState("");

  useEffect(() => {
    if (routine) setSemesterName(routine.semesterName);
  }, [routine]);

  if (!routine) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Rename routine">
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await mut.upsertSemester.mutateAsync({
              id: routine.id,
              semesterName,
            });
            toast.success("Routine renamed.");
            onOpenChange(false);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not rename.");
          }
        }}
      >
        <Field label="Routine name">
          <Input
            value={semesterName}
            onChange={(e) => setSemesterName(e.target.value)}
            required
            placeholder="e.g. Routine 2"
          />
        </Field>
        <Button type="submit" className="w-full" disabled={mut.upsertSemester.isPending}>
          {mut.upsertSemester.isPending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Dialog>
  );
}

type ThemeChoice = "light" | "dark" | "system";

function applyTheme(choice: ThemeChoice) {
  if (typeof window === "undefined") return;
  if (choice === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else if (choice === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    // system
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("rollbook-theme") as ThemeChoice) || "system";
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const stored = localStorage.getItem("rollbook-theme") as ThemeChoice | null;
      if (!stored || stored === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const handleSelect = (choice: ThemeChoice) => {
    setTheme(choice);
    localStorage.setItem("rollbook-theme", choice);
    applyTheme(choice);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => handleSelect("light")}
        className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          theme === "light"
            ? "border-accent bg-accent text-accent-fg shadow-xs"
            : "border-line bg-page text-ink-soft hover:bg-paper hover:text-ink"
        }`}
      >
        <Sun className="size-4" />
        Light
      </button>
      <button
        type="button"
        onClick={() => handleSelect("system")}
        className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          theme === "system"
            ? "border-accent bg-accent text-accent-fg shadow-xs"
            : "border-line bg-page text-ink-soft hover:bg-paper hover:text-ink"
        }`}
      >
        <Laptop className="size-4" />
        System
      </button>
      <button
        type="button"
        onClick={() => handleSelect("dark")}
        className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          theme === "dark"
            ? "border-accent bg-accent text-accent-fg shadow-xs"
            : "border-line bg-page text-ink-soft hover:bg-paper hover:text-ink"
        }`}
      >
        <Moon className="size-4" />
        Dark
      </button>
    </div>
  );
}
