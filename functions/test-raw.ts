// Raw Cloudflare Pages Function to test bindings
export async function onRequest(context: any) {
  const { env } = context;

  return new Response(JSON.stringify({
    hasDB: !!env.DB,
    hasKV: !!env.CLRHOA_USERS,
    envKeys: Object.keys(env).sort(),
    dbType: typeof env.DB,
    kvType: typeof env.CLRHOA_USERS,
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
