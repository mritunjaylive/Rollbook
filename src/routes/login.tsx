import { createFileRoute, Link, Navigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { bumpVersion } from "@/lib/use-profile-avatar";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="h-40 w-full max-w-sm animate-pulse rounded-[var(--radius-xl)] bg-line/70" />
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!authEnabled) throw new Error("Sign-in is disabled.");
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim(),
          callbackURL: typeof window !== "undefined" ? window.location.origin : "/",
        });
        if (err) throw new Error(err.message || "Could not create account.");
        setAwaitingVerification(true);
      } else {
        const { data, error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) {
          if (err.code === "EMAIL_NOT_VERIFIED" || err.message?.toLowerCase().includes("not verified")) {
            setAwaitingVerification(true);
            return;
          }
          throw new Error(err.message || "Could not sign in.");
        }
        if (data?.user?.id) {
          bumpVersion(data.user.id);
        }
        await authClient.getSession();
        await router.invalidate();
        await router.navigate({ to: "/" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: typeof window !== "undefined" ? window.location.origin : "/",
      });
      if (err) throw new Error(err.message || "Could not resend email.");
      alert("Verification email resent!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-paper">
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          College attendance
        </p>
        <div className="mt-2 flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden
            className="size-10 shrink-0 rounded-[8px]"
          />
          <h1 className="font-brand text-4xl font-semibold tracking-widest text-ink">
            Rollbook
          </h1>
        </div>
        <p className="mt-3 max-w-[34ch] text-ink-soft">
          Mark present or absent, watch the 75% line, and keep teacher credit in
          one place, synced with your email.
        </p>

        {awaitingVerification ? (
          <div className="mt-8 rounded-[calc(var(--radius-xl)+4px)] bg-page p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-xl font-semibold text-ink">Check your inbox</h2>
            <p className="mb-4 text-sm text-ink-soft">
              We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>.
              Click it to activate your account.
            </p>
            {error ? <p className="mb-3 text-sm text-warn">{error}</p> : null}
            <Button onClick={resendVerification} className="w-full" disabled={busy} variant="secondary">
              {busy ? "Please wait…" : "Resend verification email"}
            </Button>
            <Button onClick={() => setAwaitingVerification(false)} className="mt-3 w-full" variant="ghost">
              Back to sign in
            </Button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 rounded-[calc(var(--radius-xl)+4px)] bg-page p-5 shadow-[var(--shadow-card)]"
          >
            <div className="mb-5 grid grid-cols-2 rounded-[var(--radius-md)] bg-paper p-1">
              {(["in", "up"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-10 rounded-[var(--radius-sm)] text-sm font-medium",
                    mode === m ? "bg-accent text-accent-fg" : "text-ink-soft",
                  )}
                >
                  {m === "in" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {mode === "up" ? (
              <Field label="Your name" className="mb-3">
                <Input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
            ) : null}
            <Field label="Email" className="mb-3">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" className="mb-4">
              <Input
                type="password"
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </Field>
            {error ? <p className="mb-3 text-sm text-warn">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "up"
                  ? "Create account"
                  : "Sign in"}
            </Button>
            {mode === "in" ? (
              <p className="mt-3 text-center text-xs">
                <Link
                  to="/forgot-password"
                  className="text-accent underline underline-offset-2"
                >
                  Forgot your password?
                </Link>
              </p>
            ) : null}
            <p className="mt-3 text-center text-xs text-ink-faint">
              Same email on phone and computer keeps one attendance book.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
