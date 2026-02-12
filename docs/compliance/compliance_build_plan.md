# Claude Code Implementation Plan — CLRHOA Compliance System

**Date:** 2026-02-11
**Based On:** Florida HOA Compliance Audit Report (2026-02-10)
**Current Score:** 27% (4/15 requirements) → **Target:** 100%
**Architecture:** Cloudflare Workers + D1 + R2 (existing stack)

---

## Guiding Principles

These apply to every task in this plan. Claude Code should internalize these before writing any code.

### Security

- All new routes under `/board/*` must enforce `board` or `admin` role via existing middleware. No exceptions.
- All new routes under `/portal/*` must enforce `member` role minimum.
- Never expose internal IDs, stack traces, or SQL errors to the client. Return generic error messages and log details server-side.
- All file uploads must validate content type against an allowlist (`application/pdf`, `image/jpeg`, `image/png`). Reject everything else.
- All user-supplied strings used in SQL must go through D1 parameterized queries (`?` placeholders). Never interpolate.
- R2 keys for uploaded documents must be namespaced: `compliance/{requirement_id}/{timestamp}-{sanitized_filename}`. Never allow path traversal characters in filenames.
- Redaction workflow must be completed before any document is visible to members. Default `is_redacted = 0` means "not yet reviewed" — documents with `is_redacted = 0` must NOT appear in member-facing views.

### Performance

- D1 is SQLite-based with cold-start latency. Keep queries simple; avoid JOINs across more than 2 tables.
- Use single-query patterns where possible (e.g., `INSERT ... RETURNING` to avoid a second SELECT).
- Compliance dashboard should query a precomputed `compliance_status` view or materialized summary, not scan all documents on every page load.
- R2 presigned URLs for document downloads — don't proxy file bytes through Workers. Use `R2Object.writeHttpMetadata()` for direct serve when possible.
- Keep Worker bundle size small. No heavy libraries. The compliance system is CRUD — it doesn't need a framework beyond what's already in the codebase.

### Cost

- D1 is billed per rows read/written. Avoid `SELECT *` — only select columns you need.
- Avoid N+1 query patterns. If loading a compliance dashboard with 15 requirements and their latest documents, use a single query with a subquery or `GROUP BY`, not 15 separate queries.
- R2 is billed per operation + storage. Don't copy files unnecessarily. When replacing a document, archive the old R2 key in the database but don't duplicate the blob.
- No cron jobs unless absolutely necessary. Compliance checks should be computed on-demand (dashboard load) or on-write (document upload triggers status recalc), not on a timer.

### Reliability

- Every database migration must be idempotent — use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN` wrapped in try/catch (D1 doesn't support `IF NOT EXISTS` for columns, so catch the "duplicate column" error).
- All document uploads must be atomic: write to R2 first, then insert D1 row. If D1 insert fails, delete the R2 object. Use try/catch, not transactions (D1 transactions are limited).
- Never delete R2 objects when "replacing" a document. Mark the old record as `is_current = 0` and insert a new record. This preserves audit history and allows rollback.
- All timestamps must be UTC ISO 8601 (`datetime('now')` in D1). Convert to ET only in the UI layer.

### Auditability

- **Every write operation** (insert, update, delete) to any compliance-related table must also insert a row into `compliance_audit_log`. No exceptions.
- Audit log is append-only. No UPDATE or DELETE on `compliance_audit_log` — ever. Do not create any API endpoint that modifies audit log rows.
- Audit log entries must capture: `who` (email), `what` (action), `which` (table + row ID), `when` (timestamp), `details` (JSON blob of old/new values).
- Document version history is implicit: every upload creates a new row with `is_current = 1` and sets previous row to `is_current = 0`. The full history is always queryable.

---

## Task Sequence

Execute these tasks in order. Each task is self-contained and should be committed separately. Do NOT combine tasks or skip ahead.

---

### Task 0: Read and Understand the Existing Codebase

**Goal:** Before writing any code, understand the current schema, routing, middleware, and conventions.

**Instructions:**

1. Read the project's existing database schema file(s). Identify every `CREATE TABLE` statement. Note column names, types, and constraints.
2. Read the existing auth middleware. Understand how roles are checked (`member`, `arb`, `board`, `arb_board`, `admin`). Note the exact function signature and how it's applied to routes.
3. Read the existing document upload flow (both `public_documents` and `member_documents`). Understand how R2 keys are generated, how files are served, and how the upload form works.
4. Read the existing `meetings` table usage — how meetings are created, displayed, and linked to agendas.
5. Read the existing `/portal/documents` page. Understand how member documents are listed and served.
6. Read the existing `/documents` public page. Understand how public documents (covenants, bylaws) are served.
7. Note the project's conventions: file naming, route structure, error handling patterns, template engine (if any), CSS framework.

**Output:** A brief summary (in a comment or note) of:
- Auth middleware function name and usage pattern
- R2 bucket binding name
- D1 database binding name
- Route registration pattern
- Template/rendering approach
- Any existing utility functions for file uploads, date formatting, etc.

**Do NOT write any code in this task.**

---

### Task 1: Database Migrations — Core Compliance Tables

**Goal:** Create the foundational compliance tracking tables.

**File:** Create a migration file following the project's existing migration conventions (check for a `migrations/` folder or similar pattern).

**Tables to create:**

```sql
-- 1. Master list of statutory requirements
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id TEXT PRIMARY KEY,                    -- e.g., 'HOA-01'
  title TEXT NOT NULL,                    -- e.g., 'Articles of incorporation and all amendments'
  statute_reference TEXT,                 -- e.g., '§720.303(4)(a)1'
  description TEXT,                       -- Detailed description of what's required
  document_location TEXT NOT NULL,        -- 'public' | 'members' (where docs must be posted)
  review_frequency TEXT,                  -- 'annual' | 'quarterly' | 'monthly' | 'on_change' | 'permanent'
  sort_order INTEGER NOT NULL DEFAULT 0,  -- Display order
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Documents uploaded to fulfill requirements (version-tracked)
CREATE TABLE IF NOT EXISTS compliance_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirement_id TEXT NOT NULL REFERENCES compliance_requirements(id),
  title TEXT NOT NULL,
  file_key TEXT NOT NULL,                 -- R2 object key
  content_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  document_date TEXT,                     -- Date of the document itself (e.g., fiscal year, approval date)
  effective_from TEXT,                    -- When this version becomes effective
  effective_until TEXT,                   -- When this version is superseded (NULL = current)
  is_current INTEGER NOT NULL DEFAULT 1, -- 1 = active version, 0 = archived
  is_redacted INTEGER NOT NULL DEFAULT 0,-- 0 = not reviewed, 1 = redaction review complete
  redacted_by TEXT,                       -- Email of person who confirmed redaction
  redacted_at TEXT,                       -- When redaction review was completed
  uploaded_by TEXT NOT NULL,              -- Email
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT                              -- Optional notes about this version
);

-- 3. Append-only audit log
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,                   -- 'document_uploaded', 'document_archived', 'redaction_confirmed', 'requirement_status_changed', etc.
  entity_type TEXT NOT NULL,              -- 'compliance_documents', 'meetings', 'compliance_requirements', etc.
  entity_id TEXT NOT NULL,                -- ID of the affected row
  actor_email TEXT NOT NULL,              -- Who performed the action
  actor_role TEXT,                        -- Role at time of action
  details TEXT,                           -- JSON blob with old/new values or contextual info
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for audit log queries (by entity, by actor, by time)
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON compliance_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON compliance_audit_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON compliance_audit_log(created_at);

-- Index for compliance_documents queries
CREATE INDEX IF NOT EXISTS idx_compliance_docs_requirement ON compliance_documents(requirement_id, is_current);
```

**Do NOT create the `compliance_review_schedule` or `compliance_snapshots` tables yet.** Those are Phase 5 concerns and add complexity without immediate value. YAGNI.

**After creating tables, seed the requirements data:**

```sql
INSERT OR IGNORE INTO compliance_requirements (id, title, statute_reference, description, document_location, review_frequency, sort_order) VALUES
('HOA-01', 'Articles of incorporation and all amendments', '§720.303(4)(a)1', 'Recorded articles of incorporation of the association, and each amendment to the articles of incorporation', 'public', 'on_change', 1),
('HOA-02', 'Bylaws and all amendments', '§720.303(4)(a)2', 'Recorded bylaws of the association, and each amendment to the bylaws', 'public', 'on_change', 2),
('HOA-03', 'Declaration of covenants and all amendments', '§720.303(4)(a)3', 'Recorded declaration of covenants for the community, and each amendment to the declaration', 'public', 'on_change', 3),
('HOA-04', 'Current rules of the association', '§720.303(4)(a)4', 'Current rules of the association', 'public', 'on_change', 4),
('HOA-05', 'Executory contracts and bids from past year', '§720.303(4)(a)5', 'All executory contracts to which the association is a party and all bids received for work to be performed for the association within the past year', 'members', 'annual', 5),
('HOA-06', 'Annual budget and proposed budgets', '§720.303(4)(a)6', 'The current annual budget and any proposed budgets pending approval at a member meeting', 'members', 'annual', 6),
('HOA-07', 'Financial reports and monthly statements', '§720.303(4)(a)7', 'The financial report required by §720.303(7) and the annual or quarterly financial statement', 'members', 'monthly', 7),
('HOA-08', 'Current insurance policies', '§720.303(4)(a)8', 'All current insurance policies of the association', 'members', 'annual', 8),
('HOA-09', 'Director certifications', '§720.303(4)(a)9 + §720.3033(1)(a)', 'Certification for each director as required by §720.3033(1)(a), due within 90 days of election or appointment', 'members', 'on_change', 9),
('HOA-10', 'Contracts and transactions with directors or officers', '§720.303(4)(a)10', 'All contracts or transactions between the association and any director, officer, or member of the board, or their family', 'members', 'on_change', 10),
('HOA-11', 'Conflict of interest documents', '§720.303(4)(a)11 + §468.436(2)(b)6 + §720.3033(2)', 'All contracts for management of the association and related conflict of interest disclosures', 'members', 'on_change', 11),
('HOA-12', 'Member meeting notices and agendas', '§720.303(4)(a)12 + §720.306', 'Notice and agenda at least 14 days before member meeting; supporting documents at least 7 days before', 'public', 'on_change', 12),
('HOA-13', 'Board meeting notices, agendas, and documents', '§720.303(4)(a)13 + §720.303(2)(c)', 'Notice and agenda posted on website at least 48 hours before board meeting; 7 days if mailed/emailed', 'public', 'on_change', 13),
('HOA-14', 'Written records retention policy', '§720.303(4)(a)14', 'Written records retention policy describing method and duration for retaining association records', 'public', 'on_change', 14),
('HOA-15', 'Rules and covenants delivered to members via homepage', '§720.303(15)', 'Rules, covenants, and governing documents accessible to members through homepage link', 'public', 'on_change', 15);
```

**Validation:** After running the migration, query `SELECT COUNT(*) FROM compliance_requirements` — expect 15. Query `SELECT COUNT(*) FROM compliance_documents` — expect 0. Query `SELECT COUNT(*) FROM compliance_audit_log` — expect 0.

---

### Task 2: Database Migrations — Enhance Existing Tables

**Goal:** Add compliance-relevant columns to existing tables without breaking current functionality.

**Migrations:**

```sql
-- Enhance meetings table
-- Wrap each in try/catch since D1 doesn't support IF NOT EXISTS for ALTER TABLE
ALTER TABLE meetings ADD COLUMN meeting_type TEXT NOT NULL DEFAULT 'member';
ALTER TABLE meetings ADD COLUMN notice_posted_at TEXT;
ALTER TABLE meetings ADD COLUMN agenda_posted_at TEXT;
ALTER TABLE meetings ADD COLUMN supporting_docs_posted_at TEXT;

-- Enhance member_documents table
ALTER TABLE member_documents ADD COLUMN requirement_id TEXT;
ALTER TABLE member_documents ADD COLUMN document_date TEXT;
ALTER TABLE member_documents ADD COLUMN is_current INTEGER NOT NULL DEFAULT 1;
ALTER TABLE member_documents ADD COLUMN is_redacted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE member_documents ADD COLUMN redacted_by TEXT;
ALTER TABLE member_documents ADD COLUMN redacted_at TEXT;

-- Enhance public_documents table
ALTER TABLE public_documents ADD COLUMN requirement_id TEXT;
ALTER TABLE public_documents ADD COLUMN is_redacted INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public_documents ADD COLUMN redacted_by TEXT;
ALTER TABLE public_documents ADD COLUMN redacted_at TEXT;
```

**Important implementation notes:**

- Each `ALTER TABLE` must be in its own `try/catch` block. If a column already exists, D1 throws an error — catch it and continue.
- The `member_documents` default of `is_redacted = 0` is intentional: existing docs were uploaded without redaction review, so they should be flagged for review. However, since they're already visible to members, don't hide them retroactively — that would break existing functionality. The redaction workflow applies to **new** uploads going forward.
- The `public_documents` default of `is_redacted = 1` is intentional: existing public docs (covenants, bylaws) have already been reviewed by the board and are publicly posted.

**Validation:** Run `PRAGMA table_info(meetings)`, `PRAGMA table_info(member_documents)`, `PRAGMA table_info(public_documents)` — verify new columns exist.

---

### Task 3: Link Existing Documents to Compliance Requirements

**Goal:** Map existing documents (covenants, bylaws) to their compliance requirement IDs, and insert corresponding records into `compliance_documents` for tracking.

**Approach:**

1. Query `public_documents` for existing covenants/bylaws.
2. Update their `requirement_id` column.
3. Also insert rows into `compliance_documents` so the compliance dashboard can track them.
4. Log all changes to `compliance_audit_log`.

```sql
-- Link public documents to requirements
UPDATE public_documents SET requirement_id = 'HOA-02' WHERE category = 'bylaws' OR slug LIKE '%bylaws%';
UPDATE public_documents SET requirement_id = 'HOA-03' WHERE category = 'covenants' OR slug LIKE '%covenants%' OR slug LIKE '%declaration%';
UPDATE public_documents SET requirement_id = 'HOA-04' WHERE category = 'rules' OR slug LIKE '%rules%';

-- For HOA-15, no document link needed — it's satisfied by the homepage linking to /documents
```

**Important:** The exact `WHERE` clauses depend on what's actually in the database. Claude Code must first `SELECT slug, title, category FROM public_documents` to see what exists, then write the appropriate UPDATE statements. Do not guess.

For any existing `member_documents` that are budgets or financial reports, tag them:

```sql
-- Examine what exists first:
-- SELECT id, title, category FROM member_documents;
-- Then tag appropriately:
UPDATE member_documents SET requirement_id = 'HOA-06' WHERE category LIKE '%budget%';
UPDATE member_documents SET requirement_id = 'HOA-07' WHERE category LIKE '%financial%' OR category LIKE '%statement%';
```

**After linking, insert compliance_documents records** for each linked document so the compliance dashboard can show them. Also insert audit log entries for each action.

---

### Task 4: Audit Log Utility Function

**Goal:** Create a reusable function for writing audit log entries, used by all subsequent tasks.

**Location:** Place in the project's existing utility/helper directory.

```typescript
// Signature (adapt to project conventions):
async function logComplianceAction(
  db: D1Database,
  action: string,
  entityType: string,
  entityId: string,
  actorEmail: string,
  actorRole: string | null,
  details: Record<string, unknown> | null
): Promise<void> {
  await db.prepare(
    `INSERT INTO compliance_audit_log (action, entity_type, entity_id, actor_email, actor_role, details)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    action,
    entityType,
    entityId,
    actorEmail,
    actorRole,
    details ? JSON.stringify(details) : null
  ).run();
}
```

**Rules:**
- This function must never throw — wrap the INSERT in try/catch and log errors to console. Audit logging failures must not break the primary operation.
- This function must never be called with user-supplied values for `action` or `entity_type` — those are always hardcoded strings from the calling code.
- Export this function so all route handlers can import it.

---

### Task 5: Compliance Status Computation Function

**Goal:** Create a function that computes the compliance status for all 15 requirements, used by the dashboard and reporting.

**Logic for each requirement:**

| Status | Condition |
|--------|-----------|
| `compliant` | At least one `compliance_documents` row with `is_current = 1` AND `is_redacted = 1` exists for this requirement, OR requirement is satisfied by non-document means (HOA-15 homepage link) |
| `partial` | Documents exist but `is_redacted = 0` (pending review), or documents exist in `member_documents`/`public_documents` but not yet linked to `compliance_documents` |
| `missing` | No documents exist for this requirement |
| `overdue` | Same as `missing`, but the requirement has a `review_frequency` that implies a deadline has passed (e.g., annual budget not posted for current fiscal year) |

**Implementation approach:**

```sql
SELECT
  cr.id,
  cr.title,
  cr.statute_reference,
  cr.document_location,
  cr.review_frequency,
  cr.sort_order,
  COALESCE(cd_stats.doc_count, 0) as document_count,
  COALESCE(cd_stats.current_count, 0) as current_document_count,
  COALESCE(cd_stats.redacted_count, 0) as redacted_document_count,
  cd_stats.latest_upload
FROM compliance_requirements cr
LEFT JOIN (
  SELECT
    requirement_id,
    COUNT(*) as doc_count,
    SUM(CASE WHEN is_current = 1 THEN 1 ELSE 0 END) as current_count,
    SUM(CASE WHEN is_current = 1 AND is_redacted = 1 THEN 1 ELSE 0 END) as redacted_count,
    MAX(uploaded_at) as latest_upload
  FROM compliance_documents
  GROUP BY requirement_id
) cd_stats ON cr.id = cd_stats.requirement_id
ORDER BY cr.sort_order;
```

This is a single query that returns all 15 requirements with their current document status. The application layer then maps this to statuses.

**Special cases:**
- HOA-04 (current rules): Mark as compliant if HOA-02 or HOA-03 are compliant (rules are included in those docs per the audit).
- HOA-15 (homepage delivery): Always compliant — hardcode this, since it's satisfied by the `/documents` page existing.
- HOA-12 and HOA-13 (meeting notices): These require checking the `meetings` table, not just documents. Add a secondary query for meeting compliance or handle in application logic.

**Return type:** An array of objects with `{ id, title, status, documentCount, latestUpload, nextAction }`.

**Compute the overall score:** `(compliant count / 15) * 100`, rounded to nearest integer.

---

### Task 6: Board Compliance Dashboard — Route and Page

**Goal:** Create a `/board/compliance` page that shows the status of all 15 requirements.

**Route:** `GET /board/compliance`
**Auth:** Board or admin role required.

**Page content:**

1. **Overall compliance score** — large number (e.g., "27%") with a colored indicator (red < 50%, yellow 50-79%, green 80%+).
2. **Requirements table** — all 15 requirements listed with columns:
   - ID (HOA-01 through HOA-15)
   - Requirement title
   - Status badge (Compliant / Partial / Missing / Overdue)
   - Current document count
   - Last updated date
   - Action button ("Upload" if missing, "View" if compliant, "Review" if partial)
3. **Missing items alert** — prominent banner listing requirements with `missing` status.

**Implementation notes:**
- Use the compliance status function from Task 5.
- Follow the project's existing page rendering conventions (check if it uses server-side templates, JSX, or something else).
- Keep the UI simple. This is an internal board tool, not a public-facing page. Function over form.
- No client-side JavaScript needed — this is a static status page that refreshes on load.

---

### Task 7: Document Upload for Compliance Requirements

**Goal:** Allow board members to upload documents to fulfill specific compliance requirements.

**Route:** `POST /board/compliance/:requirementId/upload`
**Auth:** Board or admin role required.

**Upload form** (on the compliance dashboard or a sub-page):
- Requirement ID (from URL param, pre-filled, read-only)
- Document title (text input, required)
- Document date (date input, required — this is the date of the document itself)
- File (file input, required, max 10MB)
- Redaction confirmation checkbox: "I confirm this document has been reviewed and all protected information (SSNs, driver's licenses, credit cards, email addresses, phone numbers, emergency contacts, attorney-client privileged material) has been redacted."
- Notes (textarea, optional)

**Backend logic:**

1. Validate file type against allowlist: `['application/pdf', 'image/jpeg', 'image/png']`.
2. Validate file size ≤ 10MB.
3. Generate R2 key: `compliance/${requirementId}/${Date.now()}-${sanitizedFilename}`.
4. Upload to R2.
5. If R2 upload succeeds:
   a. Set any existing `compliance_documents` rows for this `requirement_id` with `is_current = 1` to `is_current = 0` and set `effective_until = datetime('now')`.
   b. Insert new `compliance_documents` row with `is_current = 1`.
   c. Set `is_redacted = 1` only if the redaction checkbox was checked. Otherwise `is_redacted = 0`.
   d. Log to `compliance_audit_log`: action = `'document_uploaded'`, entity_type = `'compliance_documents'`, entity_id = new row ID, details = JSON with requirement_id, title, file_key.
6. If D1 insert fails after R2 upload, delete the R2 object and return an error.
7. Redirect back to `/board/compliance` with a success message.

**Security:**
- Sanitize filename: strip path separators, null bytes, and non-alphanumeric characters (except hyphens, underscores, dots).
- Validate `requirementId` exists in `compliance_requirements` table before processing.
- Do not trust `Content-Type` header alone — also check file extension.

---

### Task 8: Document Download/View for Compliance Documents

**Goal:** Allow board members and authorized users to download compliance documents.

**Routes:**
- `GET /board/compliance/:requirementId/documents` — List all documents (current + archived) for a requirement. Board/admin only.
- `GET /board/compliance/documents/:documentId/download` — Download a specific document. Board/admin only.
- `GET /portal/compliance/:requirementId/documents` — List current documents for member-visible requirements. Members only. Only shows docs where `is_current = 1` AND `is_redacted = 1`.

**Implementation:**
- Serve files directly from R2 using the existing pattern in the codebase.
- For the board view, show version history (all documents, including archived ones, with dates and who uploaded them).
- For the member view, only show current, redacted documents. Never expose documents where `is_redacted = 0`.
- Log all downloads to `compliance_audit_log` with action = `'document_downloaded'`.

---

### Task 9: Redaction Review Workflow

**Goal:** Allow board members to mark documents as redaction-reviewed after upload.

**Route:** `POST /board/compliance/documents/:documentId/confirm-redaction`
**Auth:** Board or admin only.

**Logic:**
1. Verify the document exists and `is_redacted = 0`.
2. Update: `SET is_redacted = 1, redacted_by = ?, redacted_at = datetime('now')`.
3. Log to audit: action = `'redaction_confirmed'`.
4. After confirmation, the document becomes visible to members (if the requirement's `document_location = 'members'`).

**UI:** On the compliance dashboard, documents pending redaction review should show a yellow "Pending Review" badge with a "Confirm Redaction" button. This is a deliberate two-step process — upload, then separately confirm redaction — to force the board member to actually review the document.

---

### Task 10: Meeting Type Enhancement

**Goal:** Distinguish member meetings from board meetings for HOA-12 vs HOA-13 compliance.

**Changes to existing meeting creation flow:**

1. Add a `meeting_type` dropdown (or radio buttons) to the existing meeting creation form: "Member Meeting" or "Board Meeting".
2. When a meeting is created, auto-calculate compliance deadlines:
   - Member meeting: notice due = `meeting_datetime - 14 days`, agenda due = `meeting_datetime - 7 days`
   - Board meeting: notice due = `meeting_datetime - 48 hours`, agenda due = `meeting_datetime - 7 days`
3. Display these deadlines on the meeting detail page.
4. When a meeting notice is posted (existing `post_to_public_news` flow), set `notice_posted_at = datetime('now')`.
5. When an agenda is uploaded (existing `agenda_r2_key` flow), set `agenda_posted_at = datetime('now')`.
6. On the compliance dashboard, compute meeting compliance:
   - For each upcoming/recent meeting, check if `notice_posted_at` was before the required deadline.
   - If `notice_posted_at` is NULL or after the deadline, flag as non-compliant.

**Do not build a separate "notices page" yet.** The existing homepage news feed and meeting display are sufficient for now. The statute requires posting on the "homepage or a subpage labeled 'Notices'" — the current implementation of posting to public news satisfies this.

---

### Task 11: Audit Log Viewer

**Goal:** Allow board/admin to view the compliance audit trail.

**Route:** `GET /board/compliance/audit-log`
**Auth:** Admin only (not board — audit logs are sensitive).

**Page content:**
- Filterable by: date range, action type, actor email, entity type.
- Paginated (25 rows per page).
- Columns: Timestamp, Action, Entity, Actor, Details (expandable).
- No edit or delete capability. Read-only.

**Query:**

```sql
SELECT * FROM compliance_audit_log
WHERE (:action IS NULL OR action = :action)
  AND (:actor IS NULL OR actor_email = :actor)
  AND (:entity_type IS NULL OR entity_type = :entity_type)
  AND (:from_date IS NULL OR created_at >= :from_date)
  AND (:to_date IS NULL OR created_at <= :to_date)
ORDER BY created_at DESC
LIMIT 25 OFFSET :offset;
```

---

### Task 12: Member-Facing Compliance Documents Page

**Goal:** Expose compliant, redacted documents to members in the portal.

**Route:** `GET /portal/compliance`
**Auth:** Member role minimum.

**Page content:**
- Group documents by requirement.
- Only show requirements where `document_location = 'members'` OR `'public'`.
- Only show documents where `is_current = 1` AND `is_redacted = 1`.
- For each document: title, document date, download link.
- For requirements with no documents: show "Not yet available" (do NOT show the requirement as missing — that's board-internal information).

**Consider:** This may replace or supplement the existing `/portal/documents` page. Check the current implementation and either enhance it or create a new page, depending on what makes more sense for the existing navigation structure.

---

### Task 13: Integration Testing and Validation

**Goal:** Verify the entire system works end-to-end.

**Test scenarios (manual or scripted):**

1. **Dashboard accuracy:** Load `/board/compliance` and verify:
   - HOA-02, HOA-03, HOA-04, HOA-15 show as "Compliant" (since they were pre-existing).
   - All other requirements show correct status based on whether documents have been linked.
   - Overall score matches the count.

2. **Upload flow:**
   - Upload a PDF for HOA-01 without checking redaction → document should appear as "Pending Review" on dashboard, should NOT appear on member portal.
   - Confirm redaction → document should now appear on member portal.
   - Upload a replacement document for HOA-01 → old document should be archived, new one should be current.

3. **Audit trail:**
   - After the above operations, check `/board/compliance/audit-log` → should show entries for upload, redaction confirmation, and archive.

4. **Meeting compliance:**
   - Create a member meeting 14+ days in the future → should show as "notice due" on dashboard.
   - Post the meeting to public news → `notice_posted_at` should be set, deadline should show as met.

5. **Security:**
   - Try accessing `/board/compliance` as a member → should be rejected.
   - Try accessing `/portal/compliance` without auth → should be rejected.
   - Try uploading a `.exe` file → should be rejected.
   - Try uploading with a path traversal filename (`../../../etc/passwd`) → should be sanitized.

6. **Edge cases:**
   - Upload a document for a requirement that doesn't exist → should return 404.
   - Upload a file larger than 10MB → should be rejected with a clear error message.

---

## Deferred Work (Do NOT implement now)

These items from the audit report are intentionally deferred. They add complexity without proportional compliance value. Implement them only when the board requests them or when the core system has been running stably for at least one quarter.

| Item | Reason for Deferral |
|------|---------------------|
| `compliance_review_schedule` table | Over-engineering. Board can use the dashboard manually. |
| `compliance_snapshots` table / monthly cron | No value until there's history. Revisit Q3 2026. |
| `contracts` table (HOA-05) | Complex schema for minimal statutory risk. Board can upload contract PDFs using the generic compliance upload flow. |
| `insurance_policies` table (HOA-08) | Same — just upload PDFs via compliance upload. No need for a separate table. |
| `directors_officers` table (HOA-09) | Board member tracking is a governance concern, not a technical one. Upload certifications as PDFs. |
| Email alerts for deadlines | Requires an email sending service integration. Deferred to Phase 5. |
| PDF compliance report export | Nice-to-have, not statutory. Deferred to Phase 5. |
| Trend chart / historical scoring | No value until there's 3+ months of data. |

**Key insight:** For HOA-05, HOA-08, HOA-09, HOA-10, HOA-11, HOA-14 — the compliance upload flow (Task 7) already handles these. The board uploads a PDF, tags it with the requirement ID, confirms redaction, and it's done. There is no need for separate specialized tables for each document type. The `compliance_documents` table with its `requirement_id` foreign key is the universal solution. Build the simplest thing that achieves statutory compliance.

---

## Summary of Files to Create/Modify

| Action | File/Location | Purpose |
|--------|--------------|---------|
| Create | Migration file(s) | Tasks 1-2: New tables + column additions |
| Create | `compliance-audit-log.ts` (or similar) | Task 4: Audit log utility |
| Create | `compliance-status.ts` (or similar) | Task 5: Status computation |
| Create | Route handler for `GET /board/compliance` | Task 6: Dashboard |
| Create | Route handler for `POST /board/compliance/:id/upload` | Task 7: Upload |
| Create | Route handler for `GET .../download` | Task 8: Download |
| Create | Route handler for `POST .../confirm-redaction` | Task 9: Redaction |
| Modify | Existing meeting creation route | Task 10: Add meeting_type |
| Create | Route handler for `GET /board/compliance/audit-log` | Task 11: Audit viewer |
| Create | Route handler for `GET /portal/compliance` | Task 12: Member view |
| Modify | Existing meeting form template | Task 10: Add meeting_type field |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Migration breaks existing features | Run `PRAGMA table_info()` before and after to verify. Never drop columns. |
| R2 upload fails silently | Check R2 response for errors. Log failures. Return clear error to user. |
| D1 cold starts cause timeouts | Keep queries simple. No joins across 3+ tables. Pre-compute where possible. |
| Board forgets to review redaction | Dashboard shows "Pending Review" prominently. Docs invisible to members until reviewed. |
| Audit log grows unbounded | D1 storage is cheap. No action needed for years. If concerned, add a retention query later. |
| File type bypass (renamed .exe to .pdf) | Check magic bytes, not just Content-Type header. At minimum, verify PDF starts with `%PDF`. |

---

## Definition of Done

The system is complete when:

1. `/board/compliance` shows all 15 requirements with accurate status.
2. Board can upload documents for any requirement and they appear with correct status.
3. Redaction workflow prevents unreviewed documents from appearing to members.
4. Members can view compliant, redacted documents at `/portal/compliance`.
5. All write operations are logged in `compliance_audit_log`.
6. Existing functionality (public documents page, member portal, meeting management) is unbroken.
7. No new security vulnerabilities introduced (file upload validation, auth enforcement, SQL injection prevention).
8. Overall compliance score reflects reality and updates immediately when documents are uploaded.
