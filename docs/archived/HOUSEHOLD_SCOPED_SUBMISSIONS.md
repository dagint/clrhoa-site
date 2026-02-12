# Household-scoped submissions

Submissions and requests tied to a **property address** (household) instead of a single owner email. All owners at the same normalized address can see and interact with them.

## Existing implementation

- **ARB requests** — Uses `listEmailsAtSameAddress` (directory-db), `listArbRequestsByHousehold` / `listArbRequestsByOwnerEmails` (arb-db), and access-control helpers that allow owner or household. See `docs/DATA_ACCESS_CONTROL.md`.

## Areas that benefit from the same pattern

| Area | Current behavior | Benefit of household scope |
|------|------------------|----------------------------|
| **Maintenance requests** | `listMaintenanceByOwner(db, session.email)`; only submitter sees their requests. | All household members see and can reference the same maintenance requests (e.g. “we already reported that”). |
| **Vendor suggestions (vendor submissions)** | No “my submissions” list in portal today; board sees all. Table has `submitted_by`. | If we add a “Your suggested vendors” (or “Household suggestions”) list, show submissions from any email at the same address. Same for any API that filters by submitter. |
| **Feedback responses** | One response per (doc, owner_email). Dashboard “feedback due” uses single email. | Optional: treat “responded” as household (if any household member responded, don’t show as due for others). View-only: “someone at your address already responded.” |
| **Meeting RSVPs** | One RSVP per (meeting, owner_email). | Optional: show household RSVPs together; allow editing “our” RSVP (e.g. spouse updates). |
| **Assessments / payments** | Already “primary at address” for viewing; payments are per owner_email. | No change needed for household “submissions”; assessments are account-level. |

## Reusable construct

1. **Directory** — `listEmailsAtSameAddress(db, email)` in `directory-db.ts` (already exists).
2. **Per-feature** — For each submission type:
   - Add `listXByOwnerEmails(db, emails[])` if useful (e.g. for bulk “household” query).
   - Add `listXByHousehold(db, userEmail)` that uses `listEmailsAtSameAddress` then lists by those emails.
3. **Pages / APIs** — Replace “list by session.email” with “list by household” for member-facing lists and counts. Use household membership for any “can view / can edit” checks (like ARB’s `requireArbRequestOwner`).

## Implemented

- **ARB requests** — Full household listing and access.
- **Maintenance requests** — See implementation in `maintenance-db.ts` and portal/board call sites.
- **Vendor submissions** — `listVendorSubmissionsByHousehold` and "Household recommendations" section on portal Vendors page.
- **Feedback responses** — `householdHasResponded` in feedback-db; dashboard feedback-due count excludes docs where any household member responded; portal Feedback page shows "Someone at your address has responded" when applicable.
- **Meeting RSVPs** — `householdHasRsvpd` and `getHouseholdRsvps` in meetings-db; dashboard meetings-to-RSVP count excludes meetings where any household member has RSVP'd; portal Meetings page shows household RSVPs per meeting.

## Not implemented (candidates)

- **Vendor submissions** — Add `listVendorSubmissionsByHousehold` (and optionally “My suggestions” UI) when we want members to see their household’s suggestions.
- **Feedback** — Optional “household has responded” for due-count or display.
- **Meeting RSVPs** — Optional “household RSVPs” view or edit.
