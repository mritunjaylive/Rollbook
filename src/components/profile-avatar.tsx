/**
 * ProfileAvatar
 *
 * Renders the student photo from /api/avatar?v=<version> (browser-cached),
 * or a branded initial placeholder when no photo exists.
 *
 * When `editable` is true a camera overlay appears on hover so the user can
 * tap to pick a new file. The parent handles the actual upload and passes back
 * the new URL via onAvatarChange.
 */
import { Camera, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/use-profile-avatar";

interface ProfileAvatarProps {
  /** Versioned URL (/api/avatar?v=…) or null for no photo. */
  src: string | null;
  /** Display name used to derive the fallback initial. */
  name: string;
  /** Pixel size (width = height). Default 48. */
  size?: number;
  /** Show the upload / remove overlay. Default false. */
  editable?: boolean;
  /** Called with the validated data-URL after file selection, or null to remove. */
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
  const fontSize = Math.round(size * 0.4);

  async function handleFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      onAvatarChange?.(dataUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not load image.");
    }
  }

  return (
    <div
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      {/* Photo or initial fallback */}
      {src ? (
        <img
          src={src}
          alt={`${name}'s profile picture`}
          className="h-full w-full rounded-full object-cover ring-2 ring-line"
          style={{ width: size, height: size }}
          // If the cached URL is stale / returns 204, fall back to the initial
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full bg-accent font-semibold text-accent-fg ring-2 ring-accent/20"
          style={{ fontSize }}
          aria-label={`${name} — no profile picture`}
        >
          {initial}
        </div>
      )}

      {/* Editable overlay */}
      {editable && (
        <>
          <button
            type="button"
            aria-label="Change profile picture"
            onClick={() => fileRef.current?.click()}
            className="group absolute inset-0 flex items-center justify-center rounded-full bg-ink/0 transition-colors hover:bg-ink/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Camera
              className="size-5 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </button>

          {src && (
            <button
              type="button"
              aria-label="Remove profile picture"
              onClick={() => onAvatarChange?.(null)}
              className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-warn text-white shadow hover:bg-warn/80 focus-visible:outline-2 focus-visible:outline-accent"
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
