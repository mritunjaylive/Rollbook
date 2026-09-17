import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { requireUserId } from "@/lib/auth/verify.server";
import { randomUUID } from "node:crypto";

export const Route = createFileRoute("/api/push")({
  server: {
    handlers: {
      async POST({ request }) {
        let userId: string;
        try {
          userId = await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { endpoint: string; keys: { p256dh: string; auth: string } };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
          return new Response("Missing push subscription details", { status: 400 });
        }

        const sql = await getSql();
        await sql`
          insert into push_subscriptions (id, user_id, endpoint, p256dh, auth)
          values (${randomUUID()}, ${userId}, ${body.endpoint}, ${body.keys.p256dh}, ${body.keys.auth})
          on conflict (endpoint) do update set
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth
        `;

        return Response.json({ ok: true });
      },
    },
  },
});
