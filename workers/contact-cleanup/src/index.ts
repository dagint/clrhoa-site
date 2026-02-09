/**
 * Contact Submissions Cleanup Worker: runs on cron (monthly).
 * Deletes contact form submissions older than 1 year (same cutoff as the board report).
 * The board report already hides these; this frees storage.
 */

interface Env {
  DB: D1Database;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      await cleanupExpiredSubmissions(env);
    } catch (err) {
      console.error("Contact cleanup failed:", err);
      throw err;
    }
  },

  // Optional: allow triggering cleanup via HTTP (e.g. from portal with secret)
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/trigger" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }
    const auth = request.headers.get("Authorization");
    const secret = (env as unknown as { CLEANUP_TRIGGER_SECRET?: string }).CLEANUP_TRIGGER_SECRET;
    if (secret && auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const result = await cleanupExpiredSubmissions(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function cleanupExpiredSubmissions(env: Env): Promise<{ deleted: number }> {
  const db = env.DB;
  if (!db) {
    throw new Error("Database not available");
  }

  // Delete submissions older than 1 year (same cutoff as board report)
  const result = await db
    .prepare("DELETE FROM contact_submissions WHERE created_at < datetime('now', '-1 year')")
    .run();

  const deleted = result.meta.changes ?? 0;
  console.log(`Deleted ${deleted} expired contact submission(s)`);
  return { deleted };
}
