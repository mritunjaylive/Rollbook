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
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name.trim()[0] ?? "?").toUpperCase();

  // Reset error state if src changes
  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  async function handleFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      onAvatarChange?.(dataUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  return (
    <div
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: size, height: size }}
    >
      {src && !imgFailed ? (
        <img
          src={src}
          alt={`${name}'s profile picture`}
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={() => setImgFailed(true)}
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
              className="size-5 text-accent-fg drop-shadow transition-opacity group-hover:opacity-100 sm:opacity-0"
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
