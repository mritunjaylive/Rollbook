/**
 * /api/avatar — per-user profile picture endpoint.
 *
 * GET  /api/avatar
 *   Returns the image as raw bytes with:
 *     Cache-Control: public, max-age=86400, immutable
 *     ETag: sha256 of the data-URL (browser skips the body on 304)
 *   Falls back to 204 No Content when no avatar is stored.
 *
 * POST /api/avatar   body: { dataUrl: string }
 *   Saves or replaces the avatar (≤ 50 KB, validated server-side).
 *   Returns 200 { ok: true } and invalidates the ETag.
 *
 * DELETE /api/avatar
 *   Removes the avatar. Returns 200 { ok: true }.
 *
 * All methods require an authenticated session (401 otherwise).
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getAvatarData, upsertAvatarData, deleteAvatarData } from "@/lib/rollbook/api";
import { requireUserId } from "@/lib/auth/verify.server";

export const Route = createFileRoute("/api/avatar")({
  server: {
    handlers: {
      // ── GET ──────────────────────────────────────────────────────────────
      async GET({ request }) {
        let userId: string;
        try {
          userId = await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const result = await getAvatarData();
        if (!result.dataUrl) {
          // No avatar stored — 204 so <img> can handle it gracefully
          return new Response(null, { status: 204 });
        }

        // Parse the data-URL: data:<mime>;base64,<payload>
        const [meta, base64] = result.dataUrl.split(",");
        const mime = meta?.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
        const buffer = Buffer.from(base64 ?? "", "base64");

        // ETag is a short hash of the raw data — changes on every upload
        const etag = `"${createHash("sha256").update(buffer).digest("hex").slice(0, 16)}"`;

        // 304 Not Modified — browser already has this exact version
        if (request.headers.get("if-none-match") === etag) {
          return new Response(null, { status: 304 });
        }

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Content-Length": String(buffer.byteLength),
            // Cache for 24 h; immutable because the URL carries a ?v= version
            // param that changes on upload, so old URLs are never stale.
            "Cache-Control": "public, max-age=86400, immutable",
            ETag: etag,
            // Allow the browser to reuse the cached response cross-origin
            // (needed when the avatar is shown in an <img> on any origin).
            "Access-Control-Allow-Origin": "*",
          },
        });
      },

      // ── POST ─────────────────────────────────────────────────────────────
      async POST({ request }) {
        try {
          await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { dataUrl?: unknown };
        try {
          body = (await request.json()) as { dataUrl?: unknown };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (typeof body.dataUrl !== "string") {
          return new Response("Missing dataUrl", { status: 400 });
        }

        try {
          await upsertAvatarData({ data: { dataUrl: body.dataUrl } });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Could not save avatar.";
          return new Response(msg, { status: 422 });
        }

        return Response.json({ ok: true });
      },

      // ── DELETE ───────────────────────────────────────────────────────────
      async DELETE() {
        try {
          await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        await deleteAvatarData();
        return Response.json({ ok: true });
      },
    },
  },
});
