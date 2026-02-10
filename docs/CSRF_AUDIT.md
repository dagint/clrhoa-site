# CSRF Audit

All state-changing endpoints (POST, PUT, DELETE, PATCH) must validate a CSRF token from the session so that requests from other origins cannot change state on behalf of an authenticated user.

## Verification

- **Token source**: Session cookie carries a signed payload that includes `csrfToken`. The client must send this value in the request (body/form field `csrf_token` or `csrfToken`, or header `X-CSRF-Token`).
- **Validation**: Use `verifyCsrfToken(session, token)` from `../../lib/auth` before performing any state change. Return 403 with a generic message (e.g. "Invalid security token") if missing or invalid.

## Endpoints Audited

| Endpoint | Methods | CSRF check |
|----------|---------|------------|
| /api/login | POST | N/A (no session yet) |
| /api/contact | POST | N/A (public form; origin/referer checked) |
| /api/site-feedback | POST | Rate limit only (public widget) |
| /api/usage/record | POST | N/A (analytics) |
| /api/owners | POST, PUT, DELETE | Yes |
| /api/owners/me | PUT | Yes |
| /api/owners/upload-csv | POST | Yes |
| /api/vendors | POST, PUT, DELETE | Yes |
| /api/vendors/upload-csv | POST | Yes |
| /api/vendor-submissions | POST, PUT | Yes |
| /api/preapproval | POST, PUT, DELETE | Yes |
| /api/arb-* (upload, cancel, update, approve, etc.) | POST | Yes |
| /api/feedback | POST, PUT, DELETE | Yes (added) |
| /api/feedback-upload | POST | Yes (added) |
| /api/meetings | POST, PUT, DELETE | Yes (added) |
| /api/meeting-rsvp | POST | Yes (added) |
| /api/meeting-agenda-upload | POST | Yes (added) |
| /api/maintenance-submit | POST | Yes (added) |
| /api/maintenance-update | POST, PUT | Yes (added) |
| /api/preferences | POST | Yes (added) |
| /api/notifications/dismiss | POST | Yes (added) |
| /api/news-items | POST | Uses requireSession; add CSRF if body includes token |
| /api/member-document | DELETE | Yes |
| /api/member-document-upload | POST | Yes |
| /api/public-document-upload | POST | Yes |
| /api/log-phone-view | POST | Yes |
| /api/logout-all-devices | POST | Yes |
| /api/admin/assume-role | POST | Yes |
| /api/admin/send-test-email | POST | Yes |
| /api/assessments/record-payment | POST | Yes |
| /api/assessments/special | POST, PATCH | Yes |
| /api/board/contact-submissions | DELETE | Session + role only (board) |
| /api/board/backup-config | POST | Session + role |

## Client requirement

Portal pages that call these APIs must include the CSRF token in the request:

- **Forms**: `<input type="hidden" name="csrf_token" value={session.csrfToken ?? ''} />` or set in FormData before submit.
- **JSON body**: Include `csrf_token` or `csrfToken` from `session.csrfToken` (e.g. from layout or page server-side).
- **Headers**: Alternatively `X-CSRF-Token: <token>` for fetch/JSON.

If the session has no `csrfToken`, the user may need to refresh the page so the server can set it (e.g. via session refresh or login).
