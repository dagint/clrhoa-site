# Contact Submissions Cleanup Worker

Automated cleanup worker that deletes contact form submissions older than 1 year (same cutoff as the board report).

## Deployment

Deploy from the repo root:

```bash
npm run contact-cleanup:deploy
```

Or from this directory:

```bash
npx wrangler deploy
```

## Schedule

Runs monthly on the 1st at 3:00 AM UTC (after the backup worker runs at 2 AM UTC).

## Manual Trigger

You can also trigger cleanup manually via HTTP:

```bash
curl -X POST https://clrhoa-contact-cleanup.YOUR_SUBDOMAIN.workers.dev/trigger \
  -H "Authorization: Bearer YOUR_SECRET"
```

Set the secret via:

```bash
npx wrangler secret put CLEANUP_TRIGGER_SECRET --config workers/contact-cleanup/wrangler.toml
```

## What It Does

- Deletes all rows from `contact_submissions` where `created_at < datetime('now', '-1 year')`
- Logs the number of deleted rows
- Uses the same D1 database as the main app

## Manual Alternative

Instead of deploying the worker, you can run the SQL script manually:

```bash
npm run db:contact-submissions-delete-expired
```
