import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getSession } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { newId } from "@/lib/utils";

export const APIRoute = createAPIFileRoute("/api/sync")({
  POST: async ({ request }) => {
    const session = await getSession(request);
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = await request.json();
      const sql = await getSql();
      const uid = session.user.id;
      
      if (body.action === "markAttendance") {
        const { periodId, date, status } = body.data;
        const owned = await sql<{ id: string }>`
          select id from periods where id = ${periodId} and user_id = ${uid}
        `;
        if (owned[0]) {
          const id = newId();
          await sql`
            insert into attendance (id, user_id, period_id, date, status)
            values (${id}, ${uid}, ${periodId}, ${date}, ${status})
            on conflict (user_id, period_id, date) do update set status = excluded.status
          `;
        }
        return new Response("OK");
      }
      
      if (body.action === "markDayStatus") {
        const { date, status, periodIds } = body.data;
        for (const periodId of periodIds) {
          const id = newId();
          await sql`
            insert into attendance (id, user_id, period_id, date, status)
            values (${id}, ${uid}, ${periodId}, ${date}, ${status})
            on conflict (user_id, period_id, date) do update set status = excluded.status
          `;
        }
        return new Response("OK");
      }
      
      return new Response("Invalid action", { status: 400 });
    } catch (e) {
      console.error("Sync API error:", e);
      return new Response("Internal Error", { status: 500 });
    }
  },
});
