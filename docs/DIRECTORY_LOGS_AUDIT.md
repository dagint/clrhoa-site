# Directory Logs — Audit Data and Florida Law Compliance

The **directory_logs** table records when authenticated members reveal another member’s phone or email in the homeowner directory. This is audit data for privacy and accountability.

## What is logged

Each row includes:

- **viewer_email** — Email of the member who clicked “Reveal phone” or “Reveal email”
- **target_name** — Name of the directory entry whose contact was revealed
- **target_phone** — Phone value revealed (if any), or empty when only email was revealed
- **target_email** — Email value revealed (if any); column added by `schema-directory-logs-email.sql`
- **timestamp** — When the reveal occurred

## Retention and access (Florida law)

- **Retention:** Retain logs in line with Florida record-keeping and HOA requirements. Florida law and your association’s document retention policy may set minimum retention (e.g. 7 years for certain association records). Consult legal counsel to set a formal retention period and document it in a records retention policy.
- **Access:** Limit access to directory_logs to authorized personnel (e.g. board, admin, or designated compliance/legal) and only for legitimate purposes (audit, dispute resolution, legal process, or as required by law). Access and use should comply with:
  - Florida Statutes Chapter 720 (Homeowners’ Associations)
  - Applicable privacy and data protection requirements
- **Disclosure:** Do not disclose log contents to third parties except as required by law or court order. Use and disclosure should be documented where appropriate.

## Operational notes

- Logs are append-only from the application (no update/delete in normal use).
- For long-term compliance, consider periodic exports or archival and a process to purge or anonymize data after the retention period.
- Rate limiting on `/api/log-phone-view` (60 requests per minute per IP) helps prevent bulk scraping and reduces log volume from abuse.
