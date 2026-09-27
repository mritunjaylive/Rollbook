import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import webpush from "web-push";
import * as jose from "jose";
import {
  getUserLocalParts,
  isMorningWindow,
  isEveningWindow,
} from "@/lib/rollbook/cron-utils";

// If VAPID keys are provided in env, configure web-push
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:hello@rollbook.app",
    vapidPublicKey,
    vapidPrivateKey,
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
        let sentMorningPush = 0;
        let sentEveningPush = 0;

        /**
         * LIMITATION & DESIGN RATIONALE (Vercel Hobby Plan):
         * Vercel Hobby plan only supports daily-granularity cron jobs (each cron runs at
         * most once every 24 hours). We cannot run hourly cron jobs to catch each timezone's
         * morning or evening window in real-time.
         *
         * Therefore, we configure two daily cron runs in vercel.json (e.g. morning 01:30 UTC
         * and evening 15:30 UTC). When each cron triggers, we calculate each subscriber's
         * exact local time from their stored profile.timezone (falling back to UTC) and only
         * send the push if they currently fall within the target local morning window (7-9 AM)
         * or evening window (6-10 PM).
         */
        if (vapidPublicKey && vapidPrivateKey) {
          const subscriptions = await sql<{
            id: string;
            user_id: string;
            endpoint: string;
            p256dh: string;
            auth: string;
            student_name: string;
            timezone: string | null;
          }>`
            select p.endpoint, p.p256dh, p.auth, p.user_id, pr.student_name, pr.timezone
            from push_subscriptions p
            join profiles pr on p.user_id = pr.user_id
          `;

          const secret = new TextEncoder().encode(
            process.env.BETTER_AUTH_SECRET || "",
          );
          const now = new Date();

          for (const sub of subscriptions) {
            const local = getUserLocalParts(now, sub.timezone);

            // Helper to clean up dead subscriptions
            const sendPush = async (payload: string) => {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: {
                      p256dh: sub.p256dh,
                      auth: sub.auth,
                    },
                  },
                  payload,
                );
                return true;
              } catch (error: unknown) {
                const err = error as { statusCode?: number };
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await sql`delete from push_subscriptions where endpoint = ${sub.endpoint}`;
                } else {
                  console.error("Push sending error:", error);
                }
                return false;
              }
            };

            // 1. MORNING PUSH: Send if user is currently in their morning window (7:00–8:59 AM)
            if (isMorningWindow(local.hour)) {
              // Check if user has a holiday on their local date
              const holidays = await sql<{ id: string }>`
                select id from holidays
                where user_id = ${sub.user_id}
                  and start_date <= ${local.isoDate}::date
                  and end_date >= ${local.isoDate}::date
                limit 1
              `;

              if (holidays.length === 0) {
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
                  ],
                });

                const ok = await sendPush(payload);
                if (ok) sentMorningPush++;
              }
            }

            // 2. EVENING PUSH: Send if user is currently in their evening window (6:00–9:59 PM)
            if (isEveningWindow(local.hour)) {
              // Skip if holiday
              const holidays = await sql<{ id: string }>`
                select id from holidays
                where user_id = ${sub.user_id}
                  and start_date <= ${local.isoDate}::date
                  and end_date >= ${local.isoDate}::date
                limit 1
              `;

              if (holidays.length === 0) {
                // Get user's active semester
                const activeSem = await sql<{ id: string }>`
                  select id from semesters
                  where user_id = ${sub.user_id}
                    and is_active = true
                    and classes_over = false
                  limit 1
                `;

                if (activeSem.length > 0) {
                  // Find periods for today's weekday with no attendance marked for today's date
                  const unmarked = await sql<{ id: string }>`
                    select p.id
                    from periods p
                    join subjects s on p.subject_id = s.id
                    where p.user_id = ${sub.user_id}
                      and p.semester_id = ${activeSem[0].id}
                      and p.day_of_week = ${local.dayOfWeek}
                      and s.closed = false
                      and not exists (
                        select 1 from attendance a
                        where a.period_id = p.id
                          and a.user_id = p.user_id
                          and a.date = ${local.isoDate}::date
                      )
                  `;

                  // Skip if zero unmarked periods
                  if (unmarked.length > 0) {
                    const count = unmarked.length;
                    const token = await new jose.SignJWT({ userId: sub.user_id })
                      .setProtectedHeader({ alg: "HS256" })
                      .setIssuedAt()
                      .setExpirationTime("24h")
                      .sign(secret);

                    const payload = JSON.stringify({
                      title: "Don't forget to mark attendance",
                      body: `You have ${count} unmarked ${count === 1 ? "class" : "classes"} today.`,
                      data: {
                        url: "/",
                        token,
                      },
                      actions: [
                        { action: "view_routine", title: "Mark Now" },
                      ],
                    });

                    const ok = await sendPush(payload);
                    if (ok) sentEveningPush++;
                  }
                }
              }
            }
          }
        }

        // 3. Daily Purge of Deleted Accounts
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

        return Response.json({
          ok: true,
          sentMorningPush,
          sentEveningPush,
          purgedAccounts: expiredUsers.length,
        });
      },
    },
  },
});
