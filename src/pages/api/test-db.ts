import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = locals.runtime?.env?.DB;
    const kv = locals.runtime?.env?.CLRHOA_USERS;

    if (!db || !kv) {
      return new Response(
        JSON.stringify({
          error: 'Missing bindings',
          hasDB: !!db,
          hasKV: !!kv,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Test DB query
    const userCount = await db
      .prepare('SELECT COUNT(*) as count FROM users')
      .first<{ count: number }>();

    // Test table existence
    const tables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'sessions', 'audit_logs')"
      )
      .all();

    return new Response(
      JSON.stringify({
        success: true,
        hasDB: true,
        hasKV: true,
        userCount: userCount?.count,
        tables: tables.results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
