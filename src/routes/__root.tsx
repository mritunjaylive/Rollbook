import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { toast } from "sonner";
import { createServerFn } from "@tanstack/react-start";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppProviders } from "@/components/providers";
import { processOfflineQueue } from "@/lib/idb";
import appCss from "../styles.css?url";

const APP_NAME = "Rollbook";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRoute({
  beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content: "College attendance, credit, and 75% tracker that syncs across your devices.",
      },
      { name: "theme-color", content: "#1f4d47" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Figtree:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/__grok/rollbook-180.png" },
    ],
    scripts: [
      {
        // Runs synchronously before CSS renders \u2014 the ONLY way to avoid a
        // "flash of wrong theme" on first paint. Reads localStorage preference,
        // falls back to prefers-color-scheme, and sets data-theme on <html>.
        children: `(function(){var t=localStorage.getItem('rollbook-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}})();`,
      },
      {
        children: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); }); }`,
      },
    ],
  }),
  component: Root,
});

function Root() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});

      // Show a toast when a new SW takes over so the user can refresh
      // intentionally, rather than getting a silent reload mid-form-entry.
      let reloadPending = false;
      const handleControllerChange = () => {
        if (reloadPending) return;
        reloadPending = true;
        toast("Update available", {
          description: "A new version of Rollbook is ready.",
          action: {
            label: "Refresh",
            onClick: () => window.location.reload(),
          },
          duration: Infinity,
        });
      };
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      };
    }

    if (typeof window !== "undefined") {
      // Process queue immediately in case there are pending items and we are online (iOS fallback)
      void processOfflineQueue();
      
      const handleOnline = () => { void processOfflineQueue(); };
      window.addEventListener("online", handleOnline);
      return () => window.removeEventListener("online", handleOnline);
    }
  }, []);

  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <AppProviders>
            <Outlet />
          </AppProviders>
        </AuthProvider>
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}
