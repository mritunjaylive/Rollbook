import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if the app is already installed/running in standalone mode
    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean(window.navigator.standalone));

    setIsStandalone(inStandalone);

    if (inStandalone) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  // Hide if already installed, dismissed by user, or browser doesn't support the prompt
  if (isStandalone || isDismissed || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-line bg-paper/95 p-3 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/favicon.svg"
            alt="Rollbook"
            className="size-7 shrink-0 rounded-md"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink">Install Rollbook</p>
            <p className="truncate text-[11px] text-ink-soft">
              Add to Home Screen for faster offline access
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" onClick={handleInstallClick} className="h-8 px-3 text-xs">
            <Download className="mr-1 size-3.5" />
            Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss install prompt"
            onClick={() => setIsDismissed(true)}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-line/40 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}