import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        const response = await auth.handler(request);
        if (request.url.includes("forget-password") || request.url.includes("reset-password")) {
          console.log(`[auth handler] ${request.method} ${request.url} -> ${response.status}`);
          const body = await response.clone().text();
          console.log(`[auth handler] Response body:`, body);
        }
        return response;
      },
    },
  },
});
