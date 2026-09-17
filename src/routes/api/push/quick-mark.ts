import { createFileRoute } from "@tanstack/react-router";
import * as jose from "jose";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/utils";

export const Route = createFileRoute("/api/push/quick-mark")({
  server: {
    handlers: {
      async POST({ request }) {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }

          const token = authHeader.substring(7);
          const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET || "");
          
          const { payload } = await jose.jwtVerify<{ userId: string }>(token, secret);
          const userId = payload.userId;
          if (!userId) {
            return new Response("Invalid token payload", { status: 401 });
          }

          const { action } = await request.json();
          if (action !== "mark_all_present" && action !== "mark_sick") {
            return new Response("Invalid action", { status: 400 });
          }

          const status = action === "mark_all_present" ? "present" : "absent";
          
          // Get today's active periods for the user
          // JavaScript Date.getDay() -> 0 (Sun) to 6 (Sat)
          // Our WEEKDAYS in DB usually use 1 (Mon) to 7 (Sun)
          const now = new Date();
          // Indian Standard Time (IST) since cron runs in IST, but let's just use current date
          // For simplicity, we just format the current date
          const dateStr = now.toISOString().split("T")[0];
          
          let dayOfWeek = now.getDay();
          // Convert 0 (Sun) -> 7
          if (dayOfWeek === 0) dayOfWeek = 7;

          const sql = await getSql();

          // Get the active semester for the user
          const activeSemesters = await sql<{ id: string }>`
            select id from semesters where user_id = ${userId} and is_active = true
          `;
          const activeSemesterId = activeSemesters[0]?.id;

          if (!activeSemesterId) {
            return new Response("No active semester", { status: 400 });
          }

          // Get periods for today
          const periods = await sql<{ id: string }>`
            select p.id
            from periods p
            join subjects s on p.subject_id = s.id
            where p.user_id = ${userId}
              and p.semester_id = ${activeSemesterId}
              and p.day_of_week = ${dayOfWeek}
              and s.closed = false
          `;

          if (periods.length === 0) {
            return Response.json({ ok: true, message: "No classes today." });
          }

          // Mark attendance
          for (const p of periods) {
            const id = newId();
            await sql`
              insert into attendance (id, user_id, period_id, date, status)
              values (${id}, ${userId}, ${p.id}, ${dateStr}, ${status})
              on conflict (user_id, period_id, date) do update set status = excluded.status
            `;
          }

          return Response.json({ ok: true, marked: periods.length });
        } catch (err) {
          console.error("Quick mark error:", err);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
