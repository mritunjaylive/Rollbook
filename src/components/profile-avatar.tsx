/**
 * ProfileAvatar
 *
 * Displays the student's photo stored in localStorage, or a fallback showing
 * the first letter of their name on the Rollbook brand colour.
 *
 * When `editable` is true a camera-icon overlay appears on hover/focus so the
 * user can tap it to open a file picker. The parent is responsible for calling
 * onAvatarChange with the new data-URL (or null to clear).
 */
import { Camera, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/use-profile-avatar";

interface ProfileAvatarProps {
  /** The stored base64 data-URL, or null for no photo. */
  src: string | null;
  /** Display name used to derive the fallback initial. */
  name: string;
  /** Pixel size rendered (both width and height). Default 48. */
  size?: number;
  /** Show the upload / remove overlay. Default false. */
  editable?: boolean;
  /** Called with the new data-URL after the user picks a file, or null when removed. */
  onAvatarChange?: (dataUrl: string | null) => void;
  className?: string;
}

export function ProfileAvatar({
  src,
  name,
  size = 48,
  editable = false,
  onAvatarChange,
  className,
}: ProfileAvatarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  async function handleFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      onAvatarChange?.(dataUrl);
    } catch (err) {
      // Surface error to the user via a native alert so we don't pull in toast here
      alert(err instanceof Error ? err.message : "Could not load image.");
    }
  }

  return (
    <div
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      {/* ── Photo or initial fallback ── */}
      {src ? (
        <img
          src={src}
          alt={`${name}'s profile picture`}
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-accent font-semibold text-accent-fg"
          style={{ fontSize: Math.round(size * 0.4) }}
          aria-label={`${name}'s profile picture placeholder`}
        >
          {initial}
        </div>
      )}

      {/* ── Editable overlay ── */}
      {editable && (
        <>
          {/* Upload trigger */}
          <button
            type="button"
            aria-label="Change profile picture"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-ink/0 transition-colors hover:bg-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group"
          >
            <Camera
              className="size-5 text-white opacity-0 drop-shadow group-hover:opacity-100 transition-opacity"
              aria-hidden
            />
          </button>

          {/* Remove button — only shown when there's a photo */}
          {src && (
            <button
              type="button"
              aria-label="Remove profile picture"
              onClick={() => onAvatarChange?.(null)}
              className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-warn text-white shadow-sm hover:bg-warn/90 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </>
      )}
    </div>
  );
}
