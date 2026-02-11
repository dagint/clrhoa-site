# Florida HOA/Condo Website Compliance — Implementation Context

## Purpose

This context file guides implementation of compliance tracking and reporting for Florida's mandatory HOA/Condo website requirements under **FL Statute 720.303(4)** (HOAs with 100+ parcels) and **FL Statute 718.111(12)(g)** (Condos with 25+ units). The site being built is for an HOA, but the compliance engine should be statute-aware and reusable.

This is an Astro + TypeScript + Tailwind CSS site deployed on Cloudflare Pages with D1 database, session auth, role-based access, and existing portal/board layouts.

---

## 1. Statutes Summary

### FL Statute 720.303(4) — HOA Website Requirements

**Applies to:** HOAs with 100 or more parcels.
**Compliance deadline:** January 1, 2025 (already in effect).
**Retention:** Official records must be maintained for at least 7 years unless governing documents require longer.

#### Required Website Structure

- Must be accessible through the Internet.
- Must contain a **members-only protected section** (subpage, web portal, or similar) that is inaccessible to the general public and accessible only to parcel owners and employees.
- Upon written request, the association must provide a parcel owner with a **username and password** and access to the protected sections.
- Information protected under §720.303(5)(g) — attorney-client privilege, personal identifying information (SSNs, driver's licenses, credit cards, email addresses, phone numbers, etc.), electronic security measures, software/OS — must **NOT** be posted. If such information is contained in required documents, it must be **redacted before posting**.
- The association is not liable for inadvertent disclosure unless done with knowing or intentional disregard.

#### Documents Required on Website — §720.303(4)(b)1.a–m

Each item below is a discrete compliance requirement. Track each independently.

| ID | Requirement | Statute Ref | Notes |
|----|-------------|-------------|-------|
| HOA-01 | Articles of incorporation and all amendments | §720.303(4)(b)1.a | |
| HOA-02 | Recorded bylaws and all amendments | §720.303(4)(b)1.b | |
| HOA-03 | Declaration of covenants and all amendments | §720.303(4)(b)1.c | |
| HOA-04 | Current rules of the association | §720.303(4)(b)1.d | |
| HOA-05 | List of all current executory contracts/documents + bids received in past year (after bidding closes) | §720.303(4)(b)1.e | Bids: keep for 1 year after receipt |
| HOA-06 | Annual budget (required by §720.303(6)) and any proposed budget for annual meeting | §720.303(4)(b)1.f | |
| HOA-07 | Financial report (required by §720.303(7)) and any monthly income/expense statement for meetings | §720.303(4)(b)1.g | |
| HOA-08 | Current insurance policies | §720.303(4)(b)1.h | |
| HOA-09 | Director certifications (required by §720.3033(1)(a)) | §720.303(4)(b)1.i | Within 90 days of election/appointment |
| HOA-10 | Contracts/transactions between association and any director, officer, or entity where a director has a financial interest | §720.303(4)(b)1.j | |
| HOA-11 | Conflict of interest contracts/documents per §468.436(2)(b)6 and §720.3033(2) | §720.303(4)(b)1.k | |
| HOA-12 | Notice of member meetings + agenda, posted at least 14 days before meeting | §720.303(4)(b)1.l | Must be on homepage or labeled "Notices" subpage linked from homepage. Supporting documents must be posted at least 7 days before meeting. |
| HOA-13 | Notice of board meetings + agenda + required documents, posted per §720.303(2)(c) timeline (48 hours or 7 days depending on method) | §720.303(4)(b)1.m | |

#### Additional HOA Requirements

| ID | Requirement | Statute Ref | Notes |
|----|-------------|-------------|-------|
| HOA-14 | Written records retention policy posted on website | §720.303(4)(c) | Must describe method of retention and retention periods |
| HOA-15 | Rules and covenants provided to every member (may be met by posting on homepage with notice) | §720.303(15) | Initially required by Oct 1, 2024. Must update when amended. Notice must be sent by email (to those who consented) and mail (to all others). |

---

### FL Statute 718.111(12)(g) — Condo Website Requirements

**Applies to:** Condominiums with 25 or more units (excluding timeshares).
**Compliance deadline:** January 1, 2026.
**Note:** Previously applied only to 150+ unit condos (since Jan 1, 2019). Threshold lowered by HB 1021 (2024).

#### Required Website Structure

Same as HOA requirements above, plus:
- Website must be either an **independent site wholly owned by the association** OR a third-party site where the association has a dedicated web page/portal.
- Must have a protected section accessible only to unit owners and employees.
- Must provide username/password upon written request.

#### Documents Required on Website — §718.111(12)(g)2.a–o

| ID | Requirement | Statute Ref | Notes |
|----|-------------|-------------|-------|
| CONDO-01 | Recorded declaration of condominium and all amendments | §718.111(12)(g)2.a | |
| CONDO-02 | Recorded bylaws and all amendments | §718.111(12)(g)2.b | |
| CONDO-03 | Articles of incorporation (or other creating documents) and all amendments — must be the copy filed with Dept. of State | §718.111(12)(g)2.c | Specifically the Dept. of State filed copy |
| CONDO-04 | Current rules of the association | §718.111(12)(g)2.d | |
| CONDO-05 | List of all executory contracts/documents + bids received in past year. Bid summaries over $500 kept for 1 year. | §718.111(12)(g)2.e | Complete copies of bids may be posted in lieu of summaries |
| CONDO-06 | Annual budget (per §718.112(2)(f)) and any proposed budget for annual meeting | §718.111(12)(g)2.f | |
| CONDO-07 | Financial report (per §718.111(13)) and monthly income/expense statements for meetings | §718.111(12)(g)2.g | |
| CONDO-08 | Director certifications (per §718.112(2)(d)4.b) | §718.111(12)(g)2.h | |
| CONDO-09 | Contracts/transactions involving directors, officers, or entities where a director has a financial interest | §718.111(12)(g)2.i | |
| CONDO-10 | Conflict of interest documents per §468.4335, §468.436(2)(b)6, and §718.3027(3) | §718.111(12)(g)2.j | |
| CONDO-11 | Member meeting notice + agenda, at least 14 days before meeting. On homepage or "Notices" subpage. Supporting docs at least 7 days before meeting. | §718.111(12)(g)2.k | |
| CONDO-12 | Board meeting notice + agenda + required documents, per §718.112(2)(c) timeline | §718.111(12)(g)2.l | |
| CONDO-13 | Inspection reports per §553.899 and §718.301(4)(p) and any structural/life safety inspection reports | §718.111(12)(g)2.m | |
| CONDO-14 | Most recent structural integrity reserve study (SIRS), if applicable | §718.111(12)(g)2.n | |
| CONDO-15 | Copies of all building permits for ongoing or planned construction | §718.111(12)(g)2.o | |

#### 2025 HB 913 Amendments (Effective July 1, 2025) — Additional Condo Requirements

| ID | Requirement | Statute Ref | Notes |
|----|-------------|-------------|-------|
| CONDO-16 | Approved board meeting minutes for last 12 months | HB 913 amending §718.111(12)(g) | Must be the **approved** minutes |
| CONDO-17 | Video recordings or hyperlinks to video recordings of all meetings (association, board, committees, unit owners) conducted by video conference — last 12 months | HB 913 amending §718.111(12)(g) | Recordings must be maintained as official records for at least 1 year |
| CONDO-18 | All required documents must be posted within **30 days** of being created or received (unless a shorter period is otherwise required) | HB 913 amending §718.111(12)(g)1 | This is a timeliness requirement — track upload dates |
| CONDO-19 | Copies of all affidavits required by the Condominium Act | HB 913 | Including SIRS acknowledgment affidavits |

---

## 2. Protected Information — Do NOT Post

Both statutes prohibit posting certain information. If it appears in required documents, it must be redacted.

| Protected Category | HOA Ref | Condo Ref |
|---------------------|---------|-----------|
| Attorney-client privileged records | §720.303(5)(g)1 | §718.111(12)(c)5.a |
| Records from sale/lease/transfer approvals | §720.303(5)(g)2 | §718.111(12)(c)5.b |
| Guest visit info (gated communities) | §720.303(5)(g)3 | — |
| Personnel records (except employment agreements and compensation) | §720.303(5)(g)4 | §718.111(12)(c)5.c |
| Medical records | §720.303(5)(g)5 | §718.111(12)(c)5.d |
| SSNs, driver's license #s, credit card #s, email addresses, phone numbers, fax numbers, emergency contacts, non-notice addresses | §720.303(5)(g)6 | §718.111(12)(c)5.e |
| Electronic security measures / passwords | §720.303(5)(g)7 | §718.111(12)(c)5.f |
| Software / operating systems | §720.303(5)(g)8 | §718.111(12)(c)5.g |
| Affirmative acknowledgments (§720.3085(3)(c)3 / §718.121(4)(c)) | §720.303(5)(g)9 | §718.111(12)(c)5.h |

---

## 3. Data Model

### `compliance_requirements` Table

Stores the master list of statutory requirements. Seed this table with the items from the tables above.

```sql
CREATE TABLE compliance_requirements (
  id TEXT PRIMARY KEY,                    -- e.g., 'HOA-01', 'CONDO-13'
  statute_type TEXT NOT NULL,             -- 'HOA' or 'CONDO'
  statute_ref TEXT NOT NULL,              -- e.g., '§720.303(4)(b)1.a'
  title TEXT NOT NULL,                    -- short title
  description TEXT NOT NULL,              -- full requirement description
  category TEXT NOT NULL,                 -- 'governing_docs', 'financial', 'meetings', 'contracts', 'insurance', 'inspections', 'other'
  posting_deadline_days INTEGER,          -- NULL for static docs, 14 for meeting notices, 30 for HB913 general, etc.
  retention_years INTEGER DEFAULT 7,      -- how long to keep
  requires_redaction INTEGER DEFAULT 0,   -- 1 if document type commonly contains protected info
  sort_order INTEGER DEFAULT 0
);
```

### `compliance_documents` Table

Tracks actual documents uploaded to fulfill each requirement.

```sql
CREATE TABLE compliance_documents (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES compliance_requirements(id),
  title TEXT NOT NULL,                    -- document title as displayed
  file_key TEXT,                          -- reference to file in R2 or file system
  file_url TEXT,                          -- direct URL if hosted externally
  file_size INTEGER,                      -- bytes
  mime_type TEXT,
  uploaded_by TEXT NOT NULL,              -- user ID
  uploaded_at TEXT NOT NULL,              -- ISO 8601 timestamp
  document_date TEXT,                     -- date of the document itself (e.g., when minutes were approved)
  effective_from TEXT,                    -- when this version becomes the current one
  effective_until TEXT,                   -- NULL if current, date if superseded
  is_current INTEGER DEFAULT 1,          -- 1 = active/current version, 0 = archived
  is_redacted INTEGER DEFAULT 0,         -- 1 = has been reviewed for redaction
  redacted_by TEXT,                       -- user who confirmed redaction
  redacted_at TEXT,
  visibility TEXT DEFAULT 'members',     -- 'public' or 'members' (protected section)
  notes TEXT
);
```

### `compliance_status` View or Computed

Don't store compliance status — compute it from the data.

```sql
-- Example: find requirements with no current document
SELECT cr.id, cr.title, cr.statute_ref, cr.category,
  CASE
    WHEN cd.id IS NOT NULL THEN 'COMPLIANT'
    ELSE 'MISSING'
  END AS status,
  cd.uploaded_at AS last_updated
FROM compliance_requirements cr
LEFT JOIN compliance_documents cd
  ON cd.requirement_id = cr.id AND cd.is_current = 1
WHERE cr.statute_type = 'HOA'
ORDER BY cr.sort_order;
```

### `compliance_audit_log` Table

Append-only audit trail for all compliance actions.

```sql
CREATE TABLE compliance_audit_log (
  id TEXT PRIMARY KEY,
  requirement_id TEXT,
  document_id TEXT,
  action TEXT NOT NULL,       -- 'DOCUMENT_UPLOADED', 'DOCUMENT_REPLACED', 'DOCUMENT_ARCHIVED', 'REDACTION_CONFIRMED', 'REQUIREMENT_REVIEWED'
  actor_id TEXT NOT NULL,
  metadata TEXT,              -- JSON: additional context
  created_at TEXT NOT NULL    -- ISO 8601
);
```

### `compliance_review_schedule` Table

Track periodic review tasks (e.g., annual budget must be updated yearly, meeting notices must be posted 14 days before).

```sql
CREATE TABLE compliance_review_schedule (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES compliance_requirements(id),
  review_type TEXT NOT NULL,   -- 'ANNUAL', 'QUARTERLY', 'PER_EVENT', 'ON_CHANGE'
  next_review_date TEXT,       -- ISO 8601 date
  last_reviewed_at TEXT,
  last_reviewed_by TEXT,
  notes TEXT
);
```

---

## 4. Compliance Status Engine

### Status Categories

For each requirement, compute one of these statuses:

| Status | Meaning | Color |
|--------|---------|-------|
| `COMPLIANT` | Current document is posted, within retention period, redaction confirmed if needed | Green |
| `NEEDS_UPDATE` | Document exists but is stale (e.g., budget is from prior fiscal year, or document was modified/amended and website copy is outdated) | Yellow |
| `NEEDS_REDACTION_REVIEW` | Document uploaded but not confirmed as reviewed for protected information | Orange |
| `OVERDUE` | Document required by statute but not posted, or posting deadline exceeded (e.g., 30-day upload window for condos under HB 913) | Red |
| `MISSING` | No document has ever been uploaded for this requirement | Red |
| `NOT_APPLICABLE` | Requirement doesn't apply to this association (e.g., SIRS for buildings under 3 stories) | Gray |

### Compliance Score

Calculate an overall compliance percentage:

```
score = (COMPLIANT count) / (total requirements - NOT_APPLICABLE count) × 100
```

Display this prominently on the board dashboard.

### Deadline Tracking

For time-sensitive requirements (meeting notices, HB 913 30-day upload window):

1. When an event is created (e.g., board meeting scheduled), automatically create a compliance task with the deadline.
2. For meeting notices: deadline = meeting date minus 14 days (member meetings) or 48 hours / 7 days (board meetings depending on notice method).
3. For HB 913 condo sites: any new document must be uploaded within 30 days of creation/receipt.
4. Send notifications at configurable intervals (e.g., 7 days before deadline, 3 days before, 1 day before, overdue).

---

## 5. API Endpoints

### Compliance Dashboard

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/compliance/status` | Get compliance status for all requirements | Board/Admin |
| `GET` | `/api/compliance/status/:requirementId` | Get status for a specific requirement | Board/Admin |
| `GET` | `/api/compliance/score` | Get overall compliance score and breakdown | Board/Admin |
| `GET` | `/api/compliance/overdue` | Get all overdue or missing requirements | Board/Admin |
| `GET` | `/api/compliance/upcoming-deadlines` | Get requirements with deadlines in next 30 days | Board/Admin |

### Document Management

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/compliance/documents` | Upload a document for a requirement | Board/Admin |
| `PUT` | `/api/compliance/documents/:id` | Update document metadata | Board/Admin |
| `POST` | `/api/compliance/documents/:id/replace` | Replace a document (archives old, uploads new) | Board/Admin |
| `POST` | `/api/compliance/documents/:id/confirm-redaction` | Mark document as reviewed for redaction | Board/Admin |
| `DELETE` | `/api/compliance/documents/:id` | Archive (soft-delete) a document | Admin |
| `GET` | `/api/compliance/documents` | List documents, filterable by requirement, status | Board/Admin |

### Member-Facing (Portal)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/portal/documents` | List all current, member-visible compliance documents | Member |
| `GET` | `/api/portal/documents/:id/download` | Download a specific document | Member |
| `GET` | `/api/portal/notices` | Get current meeting notices (for homepage/notices page) | Member (or public for public notices) |

---

## 6. UI Pages

### Board/Admin Pages

#### `/board/compliance` — Compliance Dashboard

- Overall compliance score (large, prominent gauge or percentage).
- Status breakdown by category (governing docs, financial, meetings, contracts, insurance, inspections).
- List of all requirements with current status, color-coded.
- Filter by status: All / Compliant / Needs Update / Overdue / Missing.
- Each requirement row shows: statute ref, title, status badge, last updated date, action button (upload/replace/review).
- Alert banner for any OVERDUE or MISSING items.
- Upcoming deadlines section.

#### `/board/compliance/:requirementId` — Requirement Detail

- Full requirement description and statute reference.
- Current document (if any) with download link, upload date, uploaded by.
- Document history (all versions, archived documents).
- Redaction review status and confirmation button.
- Upload/replace document form.
- Audit log for this requirement.

### Member Portal Pages

#### `/portal/documents` — Association Documents

- Organized by category (governing docs, financial, meetings, etc.).
- Each document shows title, date, and download link.
- Meeting notices section at the top or on a separate `/portal/notices` page.
- This page fulfills the statutory requirement to make documents available in the protected section.

#### Homepage / Public Section

- Meeting notices must appear on the homepage or a clearly labeled "Notices" page linked from the homepage.
- Declaration of covenants and rules must be accessible from the homepage (per §720.303(15) if using website delivery method).

---

## 7. Seed Data

When initializing the compliance system, seed the `compliance_requirements` table with all items from the tables in Section 1. Use the `statute_type` field to determine which requirements apply based on the association's configuration.

Add a site configuration value:

```sql
-- In your site config or environment
-- ASSOCIATION_TYPE = 'HOA'   -- or 'CONDO'
-- PARCEL_COUNT = 150         -- determines if website requirements apply
```

The compliance engine should check:
- If `ASSOCIATION_TYPE = 'HOA'` and `PARCEL_COUNT >= 100`: HOA website requirements apply.
- If `ASSOCIATION_TYPE = 'CONDO'` and `PARCEL_COUNT >= 25`: Condo website requirements apply.
- If below thresholds: website posting is optional but recommended. Mark all requirements as `NOT_APPLICABLE` but allow voluntary compliance.

---

## 8. Compliance Reporting

### Exportable Compliance Report

Generate a printable/downloadable compliance report (PDF or formatted page) that shows:

- Association name, date of report, generated by.
- Overall compliance score.
- For each requirement: status, document title, upload date, statute reference.
- List of any overdue or missing items with recommended actions.
- Signature line for board acknowledgment.

This report is useful for:
- Board meetings (include in board packet).
- Annual meetings (demonstrate to members that the association is in compliance).
- Legal protection (evidence of good-faith compliance efforts).
- Management company reporting.

### Compliance History

Track compliance score over time. Store periodic snapshots:

```sql
CREATE TABLE compliance_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,   -- ISO 8601 date
  score REAL NOT NULL,           -- 0-100
  total_requirements INTEGER,
  compliant_count INTEGER,
  missing_count INTEGER,
  overdue_count INTEGER,
  needs_update_count INTEGER,
  needs_redaction_count INTEGER,
  not_applicable_count INTEGER,
  created_by TEXT
);
```

Take a snapshot monthly (cron or manual trigger). Display as a trend chart on the compliance dashboard.

---

## 9. Implementation Priority

### Phase 1 — Core Compliance Tracking (MVP)

1. Create database tables and seed requirement data for HOA (since this is the current site).
2. Build `/board/compliance` dashboard page showing all requirements and their status.
3. Build document upload flow tied to requirements.
4. Build `/portal/documents` page for members to access posted documents.
5. Ensure meeting notices appear on homepage or `/portal/notices`.

### Phase 2 — Automation & Alerts

1. Deadline tracking with notification system (email alerts for upcoming/overdue items).
2. Automatic compliance score calculation and display.
3. Redaction review workflow.
4. Compliance audit log.

### Phase 3 — Reporting & History

1. Exportable compliance report (PDF).
2. Compliance score snapshots and trend chart.
3. Integration with board meeting workflow (auto-create notice posting tasks when meetings are scheduled).

### Phase 4 — Condo Support (if needed)

1. Add condo-specific requirements to seed data.
2. Add HB 913 30-day posting deadline enforcement.
3. Add video recording link management.
4. Add SIRS and inspection report tracking.

---

## 10. Important Legal Notes

> **Disclaimer:** This implementation guide is for software development purposes only and does not constitute legal advice. The association should consult with a Florida community association attorney to confirm compliance requirements specific to their governing documents and circumstances.

Key legal considerations for the development team:

1. **Redaction is mandatory.** Before any document is posted, protected information (SSNs, driver's licenses, emails, phone numbers, etc.) must be redacted. The system should enforce a redaction review step before documents become visible to members.

2. **The association is not liable for inadvertent disclosure** unless it was done with knowing or intentional disregard. Still, implement safeguards.

3. **Records requests.** FL law requires the association to make records available within 10 business days (HOA) or 10 working days (Condo) of a written request. The website can satisfy this: §718.111(12)(c)1.a states that if records are posted on the website, the association may fulfill its obligations by directing requestors to the website.

4. **Failure to post is not automatically fatal.** For condos, §718.111(12)(g)4 states that failure to post required information is not in itself sufficient to invalidate any board action or decision. However, it can trigger penalties and creates legal exposure.

5. **7-year retention.** Most records must be kept for 7 years. Some (plans, bylaws, articles, declaration, minutes) must be kept permanently. Inspection reports and SIRS must be kept for 15 years.

6. **Member right to use portable devices.** Members can use smartphones/scanners to copy records at no charge. The website makes this largely moot since documents are downloadable.

7. **Minimum damages for non-compliance.** If a member is denied access to records: $50/day for up to 10 days (starting on the 11th business day after a written request). Plus actual damages and attorney fees.
