/**
 * Avatar helpers — DB-backed, browser-cached.
 *
 * Flow:
 *   - The canonical source is the DB, served via GET /api/avatar with
 *     Cache-Control: public, max-age=86400, immutable.
 *   - The URL we hand to <img> is `/api/avatar?v=<version>`. The `v` param
 *     is a counter stored in localStorage. Bumping it on upload forces the
 *     browser to re-fetch; the old URL stays cached harmlessly.
 *   - localStorage stores only the `v` counter (a small integer string),
 *     never the image bytes — so there is no 50 KB hit on storage.
 *   - On the very first render (before the DB fetch resolves) the <img> tag
 *     uses the cached URL from the last session if one exists, giving an
 *     instant paint with no flash of the fallback initial.
 */

const MAX_BYTES = 50 * 1024; // 50 KB — enforced client-side before upload

// ── Version counter (localStorage) ───────────────────────────────────────────

function versionKey(userId: string) {
  return `rollbook.avatar.v.${userId}`;
}

function getVersion(userId: string): string {
  if (typeof window === "undefined") return "0";
  return localStorage.getItem(versionKey(userId)) ?? "0";
}

function bumpVersion(userId: string): string {
  const next = String(Date.now()); // ms timestamp = unique enough
  try {
    localStorage.setItem(versionKey(userId), next);
  } catch {
    /* storage full — harmless, URL will still change in memory */
  }
  return next;
}

function clearVersion(userId: string): void {
  try {
    localStorage.removeItem(versionKey(userId));
  } catch {
    /* ignore */
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the versioned avatar URL for `<img src={…}>`.
 * Returns null when no avatar has ever been uploaded.
 */
export function getAvatarUrl(userId: string): string | null {
  if (typeof window === "undefined") return null;
  const v = getVersion(userId);
  if (v === "0") return null; // never uploaded
  return `/api/avatar?v=${v}`;
}

/**
 * Validate a File before upload.
 * Returns the base64 data-URL; rejects with a user-facing message on failure.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(
        new Error(`Image is ${Math.round(file.size / 1024)} KB — maximum is 50 KB.`),
      );
      return;
    }
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file (JPEG, PNG, WebP, etc.)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a new avatar.
 *   1. POSTs the data-URL to /api/avatar (saved to DB).
 *   2. Bumps the localStorage version counter so the URL changes.
 *   3. Returns the new versioned URL to hand straight to <img>.
 */
export async function uploadAvatar(
  userId: string,
  dataUrl: string,
): Promise<string> {
  const res = await fetch("/api/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload failed (${res.status}).`);
  }
  const v = bumpVersion(userId);
  return `/api/avatar?v=${v}`;
}

/**
 * Delete the avatar.
 *   1. DELETEs from DB via /api/avatar.
 *   2. Clears the localStorage version so getAvatarUrl returns null.
 */
export async function removeAvatar(userId: string): Promise<void> {
  const res = await fetch("/api/avatar", { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed (${res.status}).`);
  clearVersion(userId);
}
