/**
 * Transactional email sender (server-only).
 *
 * Uses Resend when `RESEND_API_KEY` is set (deployed / configured sandbox).
 * Falls back to console-logging the email so local dev / PGLite preview still
 * works without needing a real API key.
 *
 * Import only from server-side files — Resend's Node SDK must never reach the browser.
 */

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value =
    typeof process !== "undefined" ? process.env[key]?.trim() : undefined;
  return value || undefined;
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /** From address. Defaults to the RESEND_FROM_EMAIL env var, or a sensible fallback. */
  from?: string;
}

/**
 * Send a transactional email via Resend, or log it to console when the API key
 * is absent (local dev / preview without email configured).
 */
export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = env("RESEND_API_KEY");
  const fromDefault = env("RESEND_FROM_EMAIL") ?? "Rollbook <noreply@rollbook.app>";
  const from = opts.from ?? fromDefault;

  if (!apiKey) {
    // Dev / preview fallback — log so the reset link is still accessible.
    console.log(
      "[mailer] RESEND_API_KEY not set — would have sent email:\n" +
        `  To:      ${opts.to}\n` +
        `  From:    ${from}\n` +
        `  Subject: ${opts.subject}\n` +
        `  Body:    ${opts.html}\n`,
    );
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (error) {
    console.error("[mailer] Resend error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Build the HTML body for a password-reset email.
 */
export function buildPasswordResetEmail(opts: {
  resetUrl: string;
  appName?: string;
  expiresInMinutes?: number;
}): string {
  const { resetUrl, appName = "Rollbook", expiresInMinutes = 60 } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#d97706;">
                College attendance
              </p>
              <h1 style="margin:0 0 24px;font-size:28px;font-weight:700;color:#1c1814;letter-spacing:-0.02em;">
                ${appName}
              </h1>
              <p style="margin:0 0 8px;font-size:16px;color:#1c1814;font-weight:600;">
                Reset your password
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b6460;line-height:1.5;">
                We received a request to reset the password for your account.
                Click the button below to choose a new password.
                This link expires in ${expiresInMinutes} minutes.
              </p>
              <a href="${resetUrl}"
                style="display:inline-block;padding:12px 28px;background:#d97706;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:-0.01em;">
                Reset password
              </a>
              <p style="margin:24px 0 0;font-size:13px;color:#9c9390;line-height:1.5;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password won't change.
              </p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #e8e6e0;" />
              <p style="margin:0;font-size:12px;color:#b8b4b0;">
                Having trouble with the button? Copy and paste this link into your browser:<br />
                <a href="${resetUrl}" style="color:#d97706;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build the HTML body for a welcome email.
 */
export function buildWelcomeEmail(opts: {
  appName?: string;
  userName: string;
}): string {
  const { appName = "Rollbook", userName } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ${appName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#d97706;">
                College attendance
              </p>
              <h1 style="margin:0 0 24px;font-size:28px;font-weight:700;color:#1c1814;letter-spacing:-0.02em;">
                Welcome to ${appName}!
              </h1>
              <p style="margin:0 0 16px;font-size:16px;color:#1c1814;font-weight:400;line-height:1.5;">
                Hi ${userName},<br><br>
                Thanks for joining ${appName}. We're excited to help you track your college attendance, plan bunks, and monitor your credits seamlessly.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b6460;line-height:1.5;">
                Get started by creating your first semester and adding your subjects.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build the HTML body for an email verification email.
 */
export function buildVerificationEmail(opts: {
  verificationUrl: string;
  appName?: string;
}): string {
  const { verificationUrl, appName = "Rollbook" } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email for ${appName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#d97706;">
                College attendance
              </p>
              <h1 style="margin:0 0 24px;font-size:28px;font-weight:700;color:#1c1814;letter-spacing:-0.02em;">
                Verify your email
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b6460;line-height:1.5;">
                Thanks for signing up for ${appName}! Please verify your email address by clicking the button below.
              </p>
              <a href="${verificationUrl}"
                style="display:inline-block;padding:12px 28px;background:#d97706;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:-0.01em;">
                Verify email address
              </a>
              <hr style="margin:24px 0;border:none;border-top:1px solid #e8e6e0;" />
              <p style="margin:0;font-size:12px;color:#b8b4b0;">
                Having trouble with the button? Copy and paste this link into your browser:<br />
                <a href="${verificationUrl}" style="color:#d97706;word-break:break-all;">${verificationUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
