# Portal Phase 2: ARB Request Workflow

Extends the Phase 1 portal with ARB (Architectural Review Board) request submission and review.

## Setup

1. **D1 schema** (run after Phase 1 schema):
   ```bash
   npm run db:arb:init:local   # local
   npm run db:arb:init         # remote
   ```
   Or run `scripts/schema-arb.sql` in the D1 console.

2. **R2** — Same bucket `clrhoa-files`; ARB files are stored under prefix `arb/{requestId}/originals/`.

3. **Migrations** (if you already had ARB tables from an earlier schema):
   - Missing applicant/phone/address/type columns: `npm run db:arb:migrate:local` or `db:arb:migrate` (remote).
   - Missing `updated_at`: `npm run db:arb:migrate-v3:local` or `db:arb:migrate-v3` (remote).

## Routes

| Route | Who | Description |
|-------|-----|--------------|
| `/portal/arb-request` | Any authenticated | Submit new ARB request (description, attachments, e-sign) |
| `/portal/arb-request/edit/[id]` | Owner, pending only | Edit a pending request (applicant, phone, address, type, description) |
| `/portal/my-requests` | Any authenticated | List own requests; expand to view full details; Edit link when pending |
| `/portal/arb-dashboard` | ARB / Board / Admin | List all requests; Approve / Reject with e-signature |
| `/api/arb-upload` | POST, authenticated | Submit request + files (5MB/file, 25MB total) |
| `/api/arb-update` | POST, owner, pending only | Update request fields; sets `updated_at` |
| `/api/arb-resubmit` | POST, owner | Submit (or resubmit) a pending request for review → sets status to in_review |
| `/api/arb-approve` | POST, ARB/Board/Admin | Approve / Reject (in_review only) or Request revision (in_review → pending); approve/reject record arb_esign |

## Validation

- **Per file:** 5MB max; types: image/* (JPEG, PNG, GIF, WebP, HEIC) and PDF.
- **Per request:** 25MB total.
- E-signature checkbox required on submit.
- Clear error messages for size/type rejections.

## E-signature (ESIGN/UETA)

- Member: checkbox “I certify this information is accurate” at submit.
- ARB: on Approve/Reject, prompt for name/title; stored in `arb_requests.arb_esign` with timestamp and email.

## Email notification

- **Placeholder:** In `src/pages/api/arb-upload.astro` there is a comment to notify `arb@clrhoa.com` on new submission. To enable, wire in your provider (e.g. Resend, SendGrid, or Cloudflare Email Workers) via an env var and call it after creating the request.

## Image processing and verification

- **Client-side resize (browser):** On submit, images (except HEIC) are resized in the browser with Canvas:
  - **Review:** max width 2000px, JPEG 82% → stored in `arb/{requestId}/review/`
  - **Archive:** max width 1200px, JPEG 70% → stored in `arb/{requestId}/archive/`
- **Originals** are always stored unchanged in `arb/{requestId}/originals/` (legal/audit).
- **Verification:** Server validates type (image/* or PDF), 5MB per original file, 25MB total (originals only). Client validates size before submit and shows clear errors.

## Workflow (industry-standard)

- **pending** — Owner can edit (all fields). Owner clicks **Submit for review** to send to ARB.
- **in_review** — Locked for owner. ARB can: **Approve**, **Reject**, or **Request revision** (sends back to pending).
- **approved** / **rejected** — Final. No further edits.

New requests start as `pending`. Only when the owner clicks **Submit for review** does the status become `in_review` and the request appear in the ARB queue for approve/reject/request revision. If ARB clicks **Request revision**, status returns to `pending` and the owner can edit and resubmit.

## Role checks

- **arb-dashboard:** Only `arb`, `board`, or `admin` can access; others are redirected to dashboard.
- **my-requests:** Filtered by `owner_email` (session email).
- **arb-request:** Any logged-in user can submit.
- **Edit / Update:** Allowed only when status is `pending`.
- **Approve / Reject:** Allowed only when status is `in_review`.
