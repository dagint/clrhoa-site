import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    // Try multiple ways to access bindings
    const runtime = locals.runtime;
    const env = runtime?.env;

    // Debug: show what's available
    const debug = {
      hasRuntime: !!runtime,
      hasEnv: !!env,
      runtimeKeys: runtime ? Object.keys(runtime) : [],
      envKeys: env ? Object.keys(env) : [],
      // Try different accessor patterns
      db1: env?.DB,
      db2: runtime?.env?.DB,
      db3: (runtime as any)?.DB,
      kv1: env?.CLRHOA_USERS,
      kv2: env?.CLOURHOA_USERS,
    };

    const db = env?.DB;
    const kv = env?.CLRHOA_USERS;

    if (!db || !kv) {
      return new Response(
        JSON.stringify({
          error: 'Missing bindings',
          hasDB: !!db,
          hasKV: !!kv,
          debug,
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
