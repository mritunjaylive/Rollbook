import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import webpush from "web-push";
import * as jose from "jose";

// If VAPID keys are provided in env, configure web-push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:hello@rollbook.app",
    vapidPublicKey,
    vapidPrivateKey
  );
}

export const Route = createFileRoute("/api/cron/daily")({
  server: {
    handlers: {
      async GET({ request }) {
        // Simple security for cron: check cron secret if configured
        const authHeader = request.headers.get("authorization");
        if (
          process.env.CRON_SECRET &&
          authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
          return new Response("Unauthorized", { status: 401 });
        }
        const sql = await getSql();
        let sentPush = 0;


        if (vapidPublicKey && vapidPrivateKey) {
          // Check for active holidays for current date
          const subscriptions = await sql<{
            id: string;
            user_id: string;
            endpoint: string;
            p256dh: string;
            auth: string;
            student_name: string;
          }>`
            select p.endpoint, p.p256dh, p.auth, p.user_id, pr.student_name
            from push_subscriptions p
            join profiles pr on p.user_id = pr.user_id
            where not exists (
              select 1 from holidays h
              where h.user_id = p.user_id
                and h.start_date <= current_date
                and h.end_date >= current_date
            )
          `;

          const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET || "");

          const notifications = subscriptions.map(async (sub) => {
            // Sign a JWT valid for 24 hours
            const token = await new jose.SignJWT({ userId: sub.user_id })
              .setProtectedHeader({ alg: "HS256" })
              .setIssuedAt()
              .setExpirationTime("24h")
              .sign(secret);

            const payload = JSON.stringify({
              title: "Good Morning!",
              body: `Hi ${sub.student_name}, check your classes for today!`,
              data: {
                url: "/",
                token,
              },
              actions: [
                { action: "mark_all_present", title: "Mark All Present" },
                { action: "mark_sick", title: "Sick Day" },
                { action: "view_routine", title: "View Routine" },
              ]
            });

            return webpush
              .sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                  },
                },
                payload
              )
              .catch(async (error) => {
                if (error.statusCode === 410 || error.statusCode === 404) {
                  // Subscription has expired or is no longer valid
                  await sql`delete from push_subscriptions where endpoint = ${sub.endpoint}`;
                } else {
                  console.error("Push sending error:", error);
                }
              });
          });

          await Promise.allSettled(notifications);
          sentPush = notifications.length;
        }

        // 2. Daily Purge of Deleted Accounts
        const expiredUsers = await sql<{ user_id: string }>`
          select user_id from profiles
          where scheduled_deletion_date is not null
            and scheduled_deletion_date <= now()
        `;

        if (expiredUsers.length > 0) {
          for (const { user_id } of expiredUsers) {
            await sql`delete from semesters where user_id = ${user_id}`;
            await sql`delete from profiles where user_id = ${user_id}`;
            await sql`delete from "user" where id = ${user_id}`;
          }
        }

        return Response.json({ ok: true, sentPush, purgedAccounts: expiredUsers.length });
      },
    },
  },
});
