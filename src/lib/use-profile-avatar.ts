/**
 * Stores the student's profile picture in localStorage as a base64 data URL.
 * Kept client-side only — no DB column needed, no server round-trip.
 *
 * Key is scoped to the user id so multiple accounts on the same device don't
 * share a photo.
 */

const MAX_BYTES = 50 * 1024; // 50 KB

function storageKey(userId: string) {
  return `rollbook.avatar.${userId}`;
}

/** Read the stored avatar for a user. Returns null when none is set. */
export function getAvatar(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

/** Persist a base64 data-URL avatar. Throws if the image exceeds 50 KB. */
export function saveAvatar(userId: string, dataUrl: string): void {
  // data:image/...;base64,<payload> — the raw byte count is ¾ of the base64 length
  const base64Part = dataUrl.split(",")[1] ?? "";
  const approxBytes = Math.ceil((base64Part.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    throw new Error(`Image is too large (${Math.round(approxBytes / 1024)} KB). Maximum is 50 KB.`);
  }
  try {
    localStorage.setItem(storageKey(userId), dataUrl);
  } catch {
    throw new Error("Could not save avatar — storage may be full.");
  }
}

/** Remove the stored avatar for a user. */
export function clearAvatar(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}

/**
 * Read a File as a base64 data URL, validate the size, and return it.
 * Rejects with a user-facing error message on failure.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(new Error(`Image is ${Math.round(file.size / 1024)} KB — maximum is 50 KB.`));
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
