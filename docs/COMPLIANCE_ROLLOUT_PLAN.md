# Florida HOA Compliance - Phased Rollout Plan

## 🎯 Objective

Incrementally increase compliance from **27% to 100%** over 6-9 months without breaking existing functionality or overwhelming board members.

**Strategy:** Small, testable releases with clear rollback plans and zero downtime.

---

## 📊 Current State (Starting Point)

| Metric | Value | Notes |
|--------|-------|-------|
| Compliance Score | 27% | 4 of 15 requirements met |
| Compliant | 4 | HOA-02, HOA-03, HOA-04, HOA-15 |
| Partial | 0 | Will become 2-3 after Phase 1 |
| Missing | 11 | Need documents for these |
| Database Impact | Additive | No existing tables modified |
| Breaking Changes | None | All new functionality |

---

## 🗓️ Phase 1: Core Infrastructure (COMPLETED) ✅

**Duration:** 1 week
**Effort:** 5-6 days development
**Risk Level:** ⬜ Low (additive only)

### Deliverables

- ✅ Database tables (compliance_requirements, compliance_documents, compliance_audit_log)
- ✅ Compliance dashboard at `/board/compliance`
- ✅ Requirement detail pages with upload forms
- ✅ API endpoints for upload, status, file serving
- ✅ NPM scripts for migrations

### Testing Strategy

```bash
# Local testing
npm run db:compliance:all:local
npm run dev
# Navigate to /board/compliance
# Test upload flow
# Verify version history

# Production deployment
npm run db:compliance:all  # Run migrations
git push origin main        # Deploy via GitHub Actions
```

### Rollback Plan

If issues arise:
```sql
-- Rollback database (safe because no foreign keys from existing tables)
DROP TABLE IF EXISTS compliance_audit_log;
DROP TABLE IF EXISTS compliance_documents;
DROP TABLE IF EXISTS compliance_requirements;

-- Rollback enhancements (optional - nullable columns safe to keep)
ALTER TABLE member_documents DROP COLUMN requirement_id;
ALTER TABLE member_documents DROP COLUMN is_redacted;
-- etc.
```

### Success Criteria

- ✅ Dashboard loads without errors
- ✅ All 15 requirements display correctly
- ✅ Upload functionality works
- ✅ Existing features unaffected
- ✅ Build pipeline passes

### Post-Deployment Tasks

**Week 1:**
1. Monitor error logs for upload issues
2. Collect board feedback on UI/UX
3. Link existing documents (run SQL updates)

**Week 2:**
4. Board uploads 2-3 high-priority documents (Articles, Insurance, Retention Policy)
5. Verify compliance score increases to ~40%

---

## 🗓️ Phase 2: Document Upload & Redaction (Q1 2026)

**Duration:** 2-3 weeks
**Effort:** 2-3 days development + board time
**Risk Level:** ⬜ Low (optional feature)

### Goals

- Increase compliance score to **60-70%**
- Add redaction workflow to prevent PII disclosure
- Complete high-priority document uploads

### Deliverables

#### 2A: Board Document Upload Sprint (Week 1-2)

**No code changes** - Just board uploading missing documents via existing dashboard.

**Priority Order:**
1. **HOA-01:** Articles of Incorporation ➜ Score: 33%
2. **HOA-08:** Insurance policies (GL, D&O, property) ➜ Score: 40%
3. **HOA-14:** Records retention policy (draft if needed) ➜ Score: 47%
4. **HOA-05:** Current contracts (landscaping, management) ➜ Score: 53%
5. **HOA-06:** Annual budget (2026) ➜ Score: 60%
6. **HOA-07:** Financial reports (quarterly/annual) ➜ Score: 67%

**Board Time Required:** 2-4 hours total (document gathering + uploads)

#### 2B: Redaction Workflow (Week 3)

**Database Changes:**
```sql
-- Already added in Phase 1 (just document)
-- ALTER TABLE member_documents ADD COLUMN is_redacted INTEGER DEFAULT 0;
-- ALTER TABLE member_documents ADD COLUMN redacted_by TEXT;
-- ALTER TABLE member_documents ADD COLUMN redacted_at TEXT;
```

**UI Changes:**
- Add redaction checklist to upload form
- Require checkbox confirmation: "I have reviewed this document and confirmed no SSNs, driver's licenses, emails, phone numbers, or attorney-client privileged information are present"
- Add "Mark as Redacted" button to existing documents

**Files to Modify:**
- `src/pages/board/compliance/[requirementId].astro` - Add redaction checkbox to upload form
- `src/pages/api/compliance/upload.astro` - Save redaction status
- `src/lib/compliance-db.ts` - Add redaction tracking functions

**Testing:**
```bash
# Local
npm run dev
# Upload document with redaction checkbox
# Verify redacted_by and redacted_at are saved

# Production
git push origin phase-2-redaction
# Deploy
# Board confirms redaction workflow
```

### Rollback Plan

Redaction is optional metadata - can be rolled back by:
```sql
UPDATE compliance_documents SET is_redacted = 0, redacted_by = NULL, redacted_at = NULL;
```

### Success Criteria

- ✅ Compliance score reaches 60-70%
- ✅ Redaction checklist displayed on upload
- ✅ Redaction status saved to database
- ✅ No PII exposed in uploaded documents

---

## 🗓️ Phase 3: Contracts & Directors Management (Q2 2026)

**Duration:** 4-6 weeks
**Effort:** 4-6 days development + board data entry
**Risk Level:** 🟨 Medium (new tables, foreign keys)

### Goals

- Increase compliance score to **80-87%**
- Track contracts, directors, and insurance policies
- Automate conflict-of-interest disclosures

### Deliverables

#### 3A: Contracts Table (Week 1-2)

**New Table:**
```sql
CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  contract_type TEXT NOT NULL,  -- 'executory', 'director_conflict', 'cam_conflict'
  title TEXT NOT NULL,
  parties TEXT NOT NULL,
  date_entered TEXT,
  term TEXT,
  amount REAL,
  file_key TEXT,
  requirement_id TEXT,  -- HOA-05, HOA-10, or HOA-11
  created_at TEXT,
  created_by TEXT,
  FOREIGN KEY (requirement_id) REFERENCES compliance_requirements(id)
);
```

**UI:**
- `/board/contracts` - List all contracts
- `/board/contracts/new` - Add contract form
- Link to compliance dashboard

**Impact on Compliance:**
- HOA-05 compliant ➜ Score: 73%

#### 3B: Insurance Policies Table (Week 3)

**New Table:**
```sql
CREATE TABLE insurance_policies (
  id TEXT PRIMARY KEY,
  policy_type TEXT NOT NULL,  -- 'general_liability', 'directors_officers', 'property', 'umbrella'
  carrier TEXT NOT NULL,
  policy_number TEXT,
  effective_date TEXT,
  expiration_date TEXT,
  coverage_amount REAL,
  deductible REAL,
  file_key TEXT,
  requirement_id TEXT DEFAULT 'HOA-08',
  created_at TEXT,
  created_by TEXT,
  FOREIGN KEY (requirement_id) REFERENCES compliance_requirements(id)
);
```

**UI:**
- `/board/insurance` - List policies
- `/board/insurance/new` - Add policy form
- Auto-link to HOA-08

**Impact:** HOA-08 already compliant from Phase 2, but this adds proper tracking.

#### 3C: Directors & Officers Table (Week 4-5)

**New Table:**
```sql
CREATE TABLE directors_officers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'director', 'officer', 'committee_member'
  position TEXT,  -- 'president', 'treasurer', 'secretary', etc.
  email TEXT,
  phone TEXT,
  elected_date TEXT,
  term_expires TEXT,
  certification_date TEXT,  -- §720.3033(1)(a) certification
  certification_file_key TEXT,
  status TEXT DEFAULT 'active',  -- 'active', 'inactive', 'resigned'
  created_at TEXT,
  created_by TEXT
);
```

**UI:**
- `/board/directors` - List all board members
- `/board/directors/:id` - Director profile
- Upload certification form (90 days after election)

**Impact on Compliance:**
- HOA-09 compliant ➜ Score: 80%
- HOA-10 partial (if director conflicts tracked) ➜ Score: 83%
- HOA-11 partial (if CAM conflicts tracked) ➜ Score: 87%

### Testing Strategy

**Incremental Deployment:**
```bash
# Week 1: Contracts only
npm run db:contracts:local
npm run dev
# Test contracts CRUD
git push origin phase-3a-contracts

# Week 3: Insurance only
npm run db:insurance:local
npm run dev
# Test insurance CRUD
git push origin phase-3b-insurance

# Week 5: Directors only
npm run db:directors:local
npm run dev
# Test directors CRUD
git push origin phase-3c-directors
```

### Rollback Plan

Each table is independent:
```sql
-- Rollback directors
DROP TABLE IF EXISTS directors_officers;

-- Rollback insurance
DROP TABLE IF EXISTS insurance_policies;

-- Rollback contracts
DROP TABLE IF EXISTS contracts;
```

**No impact on existing compliance_documents** - those remain intact.

### Success Criteria

- ✅ Contracts tracked with proper categorization
- ✅ Insurance policies linked to HOA-08
- ✅ Director certifications uploaded within 90 days
- ✅ Compliance score reaches 80-87%
- ✅ No performance degradation

---

## 🗓️ Phase 4: Meeting Notice Compliance (Q3 2026)

**Duration:** 2-3 weeks
**Effort:** 2-3 days development
**Risk Level:** 🟨 Medium (modifies existing meetings table)

### Goals

- Increase compliance score to **93-100%**
- Automate meeting notice compliance
- Distinguish member meetings from board meetings

### Deliverables

#### 4A: Meeting Type Classification (Week 1)

**Database Changes:**
```sql
-- Already added in Phase 1, just document
-- ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'member';
-- ALTER TABLE meetings ADD COLUMN notice_posted_at TEXT;
-- ALTER TABLE meetings ADD COLUMN agenda_posted_at TEXT;
```

**UI Changes:**
- Modify `/board/meetings` to add meeting type dropdown
- Add "Post Notice" and "Post Agenda" buttons
- Auto-calculate compliance deadlines

**Compliance Logic:**
```typescript
function isMeetingCompliant(meeting) {
  const meetingDate = new Date(meeting.datetime);
  const noticePosted = new Date(meeting.notice_posted_at);
  const agendaPosted = new Date(meeting.agenda_posted_at);

  if (meeting.meeting_type === 'member') {
    // HOA-12: Notice 14 days before, agenda 7 days before
    const noticeDaysEarly = (meetingDate - noticePosted) / (1000 * 60 * 60 * 24);
    const agendaDaysEarly = (meetingDate - agendaPosted) / (1000 * 60 * 60 * 24);
    return noticeDaysEarly >= 14 && agendaDaysEarly >= 7;
  } else {
    // HOA-13: Notice 48 hours before (2 days)
    const hoursBefore = (meetingDate - noticePosted) / (1000 * 60 * 60);
    return hoursBefore >= 48;
  }
}
```

**Impact on Compliance:**
- HOA-12 compliant ➜ Score: 93%
- HOA-13 compliant ➜ Score: 100% 🎉

#### 4B: Public Notices Page (Week 2-3)

**New Page:**
- `/notices` - Public-facing meeting notices page
- Auto-populate from `meetings` table where `post_to_public_news = 1`
- Display upcoming meetings sorted by date

**Homepage Integration:**
- Add "Meeting Notices" link to homepage
- Badge showing upcoming meetings count

### Testing Strategy

```bash
# Test meeting type classification
npm run dev
# Create member meeting, set notice dates
# Verify compliance calculation

# Test public notices page
# Visit /notices
# Verify meetings display correctly
```

### Rollback Plan

If issues arise, revert UI changes:
```sql
-- Reset meeting types to default
UPDATE meetings SET meeting_type = 'member' WHERE meeting_type IS NULL;

-- Clear notice timestamps if causing issues
UPDATE meetings SET notice_posted_at = NULL, agenda_posted_at = NULL;
```

### Success Criteria

- ✅ All meetings classified correctly (member vs board)
- ✅ Notice deadlines auto-calculated
- ✅ Public notices page displays upcoming meetings
- ✅ Compliance score reaches 93-100%

---

## 🗓️ Phase 5: Compliance Reporting & Alerts (Q4 2026)

**Duration:** 3-4 weeks
**Effort:** 3-4 days development
**Risk Level:** ⬜ Low (reporting only, no database changes)

### Goals

- Generate exportable compliance reports
- Email alerts for upcoming deadlines
- Monthly compliance snapshots for trend analysis

### Deliverables

#### 5A: PDF Compliance Report (Week 1-2)

**New API:**
```typescript
// /api/compliance/report/pdf
// Generates PDF with:
// - Current compliance score
// - Status of all 15 requirements
// - Document upload history
// - Signature line for board acknowledgment
```

**UI:**
- Add "Export PDF" button to `/board/compliance`
- Include in monthly board packets

#### 5B: Compliance Snapshots (Week 2)

**New Table:**
```sql
CREATE TABLE compliance_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  compliance_score INTEGER NOT NULL,
  compliant_count INTEGER,
  partial_count INTEGER,
  missing_count INTEGER,
  metadata TEXT,  -- JSON: detailed breakdown
  created_at TEXT
);
```

**Cron Job:**
```typescript
// workers/compliance-snapshot/index.ts
// Runs monthly (1st of month)
// Captures compliance score
// Stores in snapshots table
```

**UI:**
- `/board/compliance/trends` - Line chart showing score over time
- Goal: Show progress toward 100%

#### 5C: Email Alerts (Week 3-4)

**Alert Types:**
1. **Annual Update Reminder:** "HOA-06 (Annual Budget) needs update for 2027"
2. **Meeting Notice Reminder:** "Board meeting on 2026-10-15 requires notice by 2026-10-13"
3. **Overdue Alert:** "HOA-01 (Articles of Incorporation) is still missing"

**Configuration:**
```typescript
// In D1 or KV
{
  "compliance_alerts_enabled": true,
  "alert_recipients": ["board@clrhoa.com"],
  "alert_frequency": "weekly",
  "alert_types": ["overdue", "upcoming_deadlines", "annual_updates"]
}
```

**Cron Job:**
```typescript
// workers/compliance-alerts/index.ts
// Runs weekly (Monday 9am)
// Checks for overdue/upcoming requirements
// Sends email via Resend/MailChannels
```

### Testing Strategy

```bash
# Test PDF generation
npm run dev
# Click "Export PDF" on dashboard
# Verify PDF contains all requirements

# Test snapshots
npm run db:compliance-snapshots:local
# Manually insert snapshot
# Visit /board/compliance/trends
# Verify chart displays

# Test alerts (local)
# Trigger worker manually
# Verify email sent to test address
```

### Rollback Plan

No database changes to existing tables - can disable alerts via config:
```typescript
// Disable in KV
await env.KV.put('compliance_alerts_enabled', 'false');
```

### Success Criteria

- ✅ PDF report generates correctly
- ✅ Monthly snapshots captured automatically
- ✅ Trend chart shows compliance progress
- ✅ Email alerts sent on schedule
- ✅ No false positives in alerts

---

## 📅 Deployment Timeline

| Phase | Timeline | Compliance Score | Effort | Risk |
|-------|----------|------------------|--------|------|
| **Phase 1** (Core) | Week 1 | 27% → 27% | 5-6 days | ⬜ Low |
| **Phase 2A** (Uploads) | Weeks 2-3 | 27% → 67% | Board time | ⬜ Low |
| **Phase 2B** (Redaction) | Week 4 | 67% → 67% | 2-3 days | ⬜ Low |
| **Phase 3A** (Contracts) | Weeks 5-6 | 67% → 73% | 2 days | 🟨 Medium |
| **Phase 3B** (Insurance) | Week 7 | 73% → 73% | 1 day | ⬜ Low |
| **Phase 3C** (Directors) | Weeks 8-9 | 73% → 87% | 2-3 days | 🟨 Medium |
| **Phase 4A** (Meetings) | Weeks 10-11 | 87% → 100% | 2-3 days | 🟨 Medium |
| **Phase 4B** (Notices) | Week 12 | 100% → 100% | 1 day | ⬜ Low |
| **Phase 5** (Reporting) | Weeks 13-16 | 100% → 100% | 3-4 days | ⬜ Low |

**Total Timeline:** 16 weeks (4 months)
**Total Development Effort:** 18-24 days
**Target Completion:** End of Q2 2026

---

## 🛡️ Risk Mitigation Strategies

### 1. Feature Flags

Use environment variables to enable/disable features:
```typescript
// .env
ENABLE_COMPLIANCE_DASHBOARD=true
ENABLE_REDACTION_WORKFLOW=false  // Phase 2
ENABLE_CONTRACT_MANAGEMENT=false // Phase 3
ENABLE_MEETING_AUTOMATION=false  // Phase 4
ENABLE_COMPLIANCE_ALERTS=false   // Phase 5
```

**Benefit:** Instant rollback without code deployment.

### 2. Gradual Rollout

Deploy to staging first:
```bash
# Deploy to preview URL
git push origin phase-X-feature

# Test on Cloudflare Pages preview
# https://abc123.clrhoa-site.pages.dev

# If issues found, fix before merging to main
```

### 3. Database Migrations are Additive

**Never modify existing columns** - always add new ones:
```sql
-- ✅ GOOD: Add new column (nullable)
ALTER TABLE meetings ADD COLUMN meeting_type TEXT DEFAULT 'member';

-- ❌ BAD: Modify existing column
ALTER TABLE meetings ALTER COLUMN datetime SET NOT NULL;  -- Don't do this!
```

### 4. Monitoring & Alerts

Set up error tracking:
```typescript
// Log all upload failures
if (!uploadSuccess) {
  console.error('[COMPLIANCE] Upload failed:', {
    requirementId,
    actorEmail,
    error: err.message
  });
  // Send to logging service (Sentry, Cloudflare Logs, etc.)
}
```

### 5. Board Communication

Send weekly updates:
```
Subject: Compliance Dashboard Update - Week X

Current Status:
- Compliance Score: 67% (up from 60% last week)
- New Documents: 2 (Insurance policies, Retention policy)
- Next Priority: Upload director certifications (HOA-09)

Action Needed:
- [ ] Board President: Upload signed certification
- [ ] Secretary: Upload meeting minutes

Questions? Visit /board/compliance
```

---

## 🎓 Training & Documentation

### For Board Members

**Week 1 (Post Phase 1 Deployment):**
- Video walkthrough: "How to Use the Compliance Dashboard"
- PDF guide: "Uploading Documents Step-by-Step"
- FAQ: "Common Questions About Compliance"

**Week 2 (After First Uploads):**
- Live demo during board meeting
- Q&A session
- Assign document upload responsibilities

### For Developers

**Documentation to Create:**
1. **Database Schema Diagram** - Visual representation of all tables
2. **API Documentation** - Swagger/OpenAPI spec for all endpoints
3. **Runbook** - "How to troubleshoot common issues"
4. **Deployment Checklist** - Step-by-step deployment guide

---

## ✅ Success Metrics

Track these KPIs throughout rollout:

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Compliance Score | 27% | 100% | /board/compliance dashboard |
| Missing Documents | 11 | 0 | Database query |
| Board Upload Frequency | 0/month | 2-3/month | Audit log |
| Average Upload Time | N/A | <5 min | User feedback |
| System Uptime | 99.9% | 99.9% | Cloudflare metrics |
| Error Rate | 0% | <1% | Error logs |

---

## 🚨 Incident Response Plan

If critical issues occur:

### Severity 1: Dashboard Down / Data Loss
1. Immediately revert to previous deployment
2. Restore database from backup (Cloudflare D1 snapshots)
3. Notify board members via email
4. Investigate root cause
5. Fix and re-deploy with additional testing

### Severity 2: Upload Failures / UI Issues
1. Disable upload form via feature flag
2. Display maintenance message
3. Fix issue in staging
4. Deploy fix
5. Re-enable upload form

### Severity 3: Minor UI Bugs / Performance
1. Log issue in GitHub
2. Prioritize for next release
3. No immediate action needed

---

## 📝 Documentation Checklist

Before each phase deployment:

- [ ] Update README.md with new features
- [ ] Add migration scripts to `/scripts` folder
- [ ] Document API endpoints in `/docs/API.md`
- [ ] Update CLAUDE.md with new phase info
- [ ] Create PR with detailed description
- [ ] Record demo video (for complex features)
- [ ] Update compliance audit report

---

## 🎉 Conclusion

This phased approach ensures:
- ✅ **Zero downtime** - All changes are additive
- ✅ **Testable increments** - Each phase can be tested independently
- ✅ **Rollback capability** - Can revert any phase without affecting others
- ✅ **Stakeholder buy-in** - Board sees progress incrementally
- ✅ **Legal compliance** - Steady progress toward 100%

**Next Steps:**
1. Merge Phase 1 PR
2. Run production migrations
3. Communicate with board about new dashboard
4. Begin Phase 2A document uploads

**Questions?** Contact development team or refer to `/docs/COMPLIANCE_ROLLOUT_PLAN.md`
