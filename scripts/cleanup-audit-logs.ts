/**
 * Audit Log Cleanup Script
 *
 * Enforces retention policies for audit logs and security events.
 * Should be run periodically via cron job or Cloudflare Cron Trigger.
 *
 * Usage:
 *   node scripts/cleanup-audit-logs.ts --local
 *   node scripts/cleanup-audit-logs.ts --remote
 *
 * Or via npm:
 *   npm run db:cleanup-audit-logs:local
 *   npm run db:cleanup-audit-logs:remote
 */

import { cleanupAuditLogs, cleanupSecurityEvents } from '../src/lib/audit-log';

const AUDIT_LOG_RETENTION_DAYS = 365;  // 1 year
const SECURITY_EVENT_RETENTION_DAYS = 730;  // 2 years

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--remote') ? 'remote' : 'local';

  console.log(`[cleanup] Starting audit log cleanup (${mode} mode)...`);
  console.log(`[cleanup] Audit logs retention: ${AUDIT_LOG_RETENTION_DAYS} days`);
  console.log(`[cleanup] Security events retention: ${SECURITY_EVENT_RETENTION_DAYS} days (resolved only)`);

  // Note: In production, this would be called via a Cloudflare Worker cron trigger
  // that has access to env.DB. For manual cleanup, we'd need to use wrangler CLI.

  console.log(`
[cleanup] This script requires D1 database access via Cloudflare Worker.

For automated cleanup, create a Cloudflare Worker Cron Trigger:

1. Add to wrangler.toml:
   [triggers]
   crons = ["0 2 * * *"]  # Run daily at 2 AM UTC

2. Create worker at src/cron/cleanup-audit-logs.ts:
   import { cleanupAuditLogs, cleanupSecurityEvents } from '../lib/audit-log';

   export default {
     async scheduled(event, env, ctx) {
       const db = env.DB;
       const auditDeleted = await cleanupAuditLogs(db, 365);
       const securityDeleted = await cleanupSecurityEvents(db, 730);
       console.log(\`Deleted \${auditDeleted} audit logs, \${securityDeleted} security events\`);
     }
   };

3. Deploy: wrangler deploy

For manual cleanup via wrangler CLI, run SQL directly:
  wrangler d1 execute clrhoa_db --${mode} --command="DELETE FROM audit_logs WHERE timestamp < datetime('now', '-365 days')"
  wrangler d1 execute clrhoa_db --${mode} --command="DELETE FROM security_events WHERE timestamp < datetime('now', '-730 days') AND resolved = 1"
  `);
}

main().catch(console.error);
