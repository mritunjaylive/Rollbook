import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/vapid-public-key")({
  server: {
    handlers: {
      async GET() {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        if (!publicKey) {
          return new Response(JSON.stringify({ error: "VAPID key not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return Response.json({ publicKey });
      },
    },
  },
});
