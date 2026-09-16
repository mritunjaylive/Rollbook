import { InstallPrompt } from "@/components/install-prompt";
import { Link, Navigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Settings,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAvatarUrl } from "@/lib/use-profile-avatar";
import { selectActive, useSnapshot } from "@/lib/rollbook/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Today", icon: CalendarCheck },
  { to: "/timetable", label: "Routine", icon: CalendarRange },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/settings", label: "More", icon: Settings },
] as const;

export function AppShell({
  children,
  nav = true,
}: {
  children: ReactNode;
  nav?: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  const snapshot = useSnapshot();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // ALL hooks unconditionally at the top — fixes React Error #310.
  // avatarUrl is the versioned /api/avatar?v=… URL (or null).
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    setAvatarUrl(user?.id ? getAvatarUrl(user.id) : null);
  }, [user?.id]);

  useEffect(() => {
    function onAvatarUpdate() {
      setAvatarUrl(user?.id ? getAvatarUrl(user.id) : null);
    }
    window.addEventListener("rollbook:avatar-updated", onAvatarUpdate);
    return () => window.removeEventListener("rollbook:avatar-updated", onAvatarUpdate);
  }, [user?.id]);

  // Early returns after all hooks.
  if (isPending) return <ShellSkeleton />;
  if (!user) return <RedirectToSignIn />;
  if (snapshot.isLoading) return <ShellSkeleton />;

  const profile = snapshot.data?.profile ?? null;
  if (!profile && pathname !== "/setup") return <Navigate to="/setup" />;

  const active = selectActive(snapshot.data);
  const subtitle = active.semester
    ? `${active.semester.courseName} · ${active.semester.semesterName}`
    : profile
      ? profile.collegeName
      : "Set up your roll";

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col bg-paper">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 px-4 py-3 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">

          {/* ── Logo + wordmark ── */}
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden
              className="size-10 shrink-0 rounded-[8px]"
            />
            <div className="min-w-0">
              <p className="font-brand text-[1.35rem] font-semibold leading-tight tracking-widest text-ink">
                Rollbook
              </p>
              <p className="truncate text-xs text-ink-soft">{subtitle}</p>
            </div>
          </div>

          {/* ── Avatar → taps to settings ── */}
          {profile ? (
            <Link to="/settings" aria-label="Open settings">
              <ProfileAvatar
                src={avatarUrl}
                name={profile.studentName}
                size={38}
              />
            </Link>
          ) : null}
        </div>
      </header>

      <main className={cn("flex-1 px-4 py-4", nav && "pb-24")}>{children}</main>

      {nav ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
          <ul className="mx-auto grid max-w-5xl grid-cols-5">
            {NAV.map((item) => {
              const on =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                      on ? "text-accent" : "text-ink-faint hover:text-ink",
                    )}
                  >
                    <item.icon className="size-5" strokeWidth={on ? 2.2 : 1.8} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <InstallPrompt />
    </div>
  );
}

export function ShellSkeleton() {
  return (
    <div className="mx-auto min-h-dvh max-w-5xl bg-paper px-4 py-8">
      <div className="flex items-center gap-2.5">
        <div className="size-10 rounded-[8px] bg-line/60" />
        <p className="font-brand text-[1.35rem] font-semibold tracking-widest text-ink">
          Rollbook
        </p>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Loading your attendance book…</p>
      <div className="mt-8 h-40 animate-pulse rounded-[var(--radius-xl)] bg-line/60" />
      <div className="mt-4 h-28 animate-pulse rounded-[var(--radius-xl)] bg-line/50" />
    </div>
  );
}
