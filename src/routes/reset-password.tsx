import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

// Better Auth appends ?token=<value> to the redirectTo URL we pass in
// forgetPassword. Pull it out with a validated search-param schema.
const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: searchSchema,
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No token in the URL — the user landed here directly, not via the email link.
  if (!token) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-base font-semibold text-ink">Invalid link</p>
          <p className="mt-2 text-sm text-ink-soft">
            This reset link is missing or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="mt-5 inline-block text-sm text-accent underline underline-offset-2"
          >
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token: token as string,
      });
      if (err) throw new Error(err.message || "Could not reset password.");
      setDone(true);
      // Auto-redirect to login after a short delay so the user sees the
      // success state before being sent away.
      setTimeout(() => router.navigate({ to: "/login" }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-2xl">
            ✅
          </div>
          <p className="text-base font-semibold text-ink">Password updated</p>
          <p className="mt-2 text-sm text-ink-soft">
            Your password has been changed. Redirecting you to sign in…
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block text-sm text-accent underline underline-offset-2"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[repeating-linear-gradient(transparent,transparent_27px,rgba(28,24,20,0.05)_28px)]"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          College attendance
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">
          Rollbook
        </h1>

        <form
          onSubmit={submit}
          className="mt-8 rounded-[calc(var(--radius-xl)+4px)] bg-page p-5 shadow-[var(--shadow-card)]"
        >
          <p className="mb-5 text-sm font-semibold text-ink">
            Choose a new password
          </p>
          <Field label="New password" className="mb-3">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </Field>
          <Field label="Confirm new password" className="mb-4">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </Field>
          {error ? <p className="mb-3 text-sm text-warn">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Set new password"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          <Link
            to="/login"
            className="text-accent underline underline-offset-2"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
