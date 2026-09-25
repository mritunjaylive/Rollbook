import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Try requestPasswordReset first, fallback to forgetPassword
      const method = authClient.requestPasswordReset || authClient.forgetPassword;
      const { error: err } = await method({
        email: email.trim().toLowerCase(),
        redirectTo: typeof window !== "undefined" ? window.location.origin + "/reset-password" : "/reset-password",
      });
      // If the user doesn't exist, Better Auth might return a 404 or an error.
      // We should still show the success screen to prevent email enumeration.
      if (err) {
        console.error("============= FORGET PASSWORD ERROR =============");
        console.error("Status:", err.status);
        console.error("Code:", err.code);
        console.error("Message:", err.message);
        console.error("Full error object:", JSON.stringify(err, null, 2));
      }
      if (err && err.status !== 404 && !err.message?.toLowerCase().includes("not found")) {
        throw new Error(err.message || "Could not send reset email.");
      }
      setSent(true);
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
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">
          Rollbook
        </h1>

        <div className="mt-8 rounded-[calc(var(--radius-xl)+4px)] bg-page p-5 shadow-[var(--shadow-card)]">
          {sent ? (
            <div className="py-2 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-2xl">
                ✉️
              </div>
              <p className="text-base font-semibold text-ink">Check your inbox</p>
              <p className="mt-2 text-sm text-ink-soft">
                If <span className="font-medium text-ink">{email}</span> has an
                account, we sent a reset link. It expires in 60 minutes.
              </p>
              <p className="mt-4 text-xs text-ink-faint">
                Didn't get it? Check your spam folder, or{" "}
                <button
                  type="button"
                  className="text-accent underline underline-offset-2"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm text-ink-soft">
                Enter the email you signed up with and we'll send a reset link.
              </p>
              <form onSubmit={submit}>
                <Field label="Email" className="mb-4">
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                </Field>
                {error ? (
                  <p className="mb-3 text-sm text-warn">{error}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-ink-soft">
          Remember your password?{" "}
          <Link to="/login" className="text-accent underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
