# Data & Access Control

How the site controls who can see and change what data. Use this to keep the public/portal/board boundary clear and to avoid leaking sensitive data.

## Principles

1. **Public pages** use only `PUBLIC_*` env and DB helpers that return limited, non-PII data (e.g. `listMeetingsForPublicNews`, `listPublicVendors`, `listPublicDocuments`).
2. **Portal (member) pages** require a valid session; data is scoped by `session.email` (or primary owner at same address for assessments).
3. **Board/elevated APIs** require session + elevated role (board, arb, admin, arb_board); middleware and/or route logic enforce this.
4. **Ownership** is checked in one place where possible (e.g. `requireArbRequestOwner`, `requireArbRequestAccess` in `src/lib/access-control.ts`).

## Public vs private data

| Data | Public | Portal (member) | Board / elevated |
|------|--------|------------------|------------------|
| News / meetings (post_to_public_news) | ✅ Title, datetime, description, location | — | Full CRUD |
| Vendors (show_on_public) | ✅ Name, category, website | — | Full + phone/email/notes |
| Public documents (bylaws, etc.) | ✅ Slug, title, link (no updated_by) | — | Upload/replace |
| ARB requests | — | Own only (`listArbRequestsByOwner`) | All + approve/reject |
| Directory (owners) | — | Limited (see Directory & logging) | Export + full |
| Assessments / payments | — | Own (or primary at address) | All + record payment |
| Member documents (minutes, budgets) | — | All (shared library) | Upload, delete |
| Feedback docs / responses | — | Own response per doc | All + create/update/delete |

## Centralized helpers

- **`requireArbRequestAccess(db, requestId, session)`** — Returns the ARB request if the user is the **owner or elevated**; otherwise 403/404. Use for viewing/downloading request or attachments.
- **`requireArbRequestOwner(db, requestId, session, { requirePending?: true })`** — Returns the request only if the user is the **owner** (and optionally status is `pending`). Use for cancel, add file, remove file.
- **Member document file serve** — `/api/portal/file/member-docs/...` only serves keys that exist in `member_documents` (`getMemberDocumentByFileKey`). Prevents serving arbitrary R2 paths.

## What we log (audit)

- **Directory** — `insertDirectoryLog` when a user reveals a phone or email; `insertDirectoryExportLog` when an elevated user exports the full directory. Portal “My activity” shows the current user’s directory actions via `listDirectoryLogsByViewer`.
- **ARB** — Audit log in `arb_audit_log` for status changes, approvals, revisions (see arb-db and board audit views).

## Search

- **Portal search** (`runPortalSearch`) — ARB results are restricted: **members** see only their own requests; **elevated** see all. Meetings, vendors, feedback docs, preapproval are the same for all authenticated users. **Owners** list is currently returned to any authenticated user (name, address, id); consider restricting to board-only or to owners who opted in to share if you want tighter directory control.

## Raising the score further

- Use **`requireArbRequestAccess`** / **`requireArbRequestOwner`** in any new ARB-related API that takes a `requestId`.
- When adding new “my data” endpoints, always scope by **`session.email`** (or primary owner at address where appropriate).
- Keep **public** DB helpers returning only the fields needed for the public UI; avoid passing through `updated_by_*` or other PII.
- Optionally add audit logging for other sensitive actions (e.g. board viewing payment history for an owner, board deleting a member document) if you need a fuller trail.
