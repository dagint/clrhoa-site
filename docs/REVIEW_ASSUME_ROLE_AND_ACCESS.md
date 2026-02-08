# Review: Assume-Role & Access Control — UX, Security, PII

Review of the recent admin/arb_board assume-role and role-based access updates, with a focus on **ease of use for non-tech users**, **security**, and **PII protection**.

---

## What’s in good shape

- **Role rules:** Admin and arb_board must choose Board or ARB (one at a time); timeout and audit are in place.
- **Audit:** Assume/clear and actions-while-assumed are logged; Board audit page shows who did what.
- **PII in logs:** Existing patterns (maskEmail, maskPhone, directory_logs for reveals, ARB audit) are consistent; assume-role audit stores actor email for accountability, which is appropriate for an audit trail.
- **Security:** CSRF and origin checks on assume-role API; session cookie HttpOnly/Secure/SameSite; elevated APIs gated by middleware and role checks.
- **Docs:** DATA_ACCESS_CONTROL, DIRECTORY_LOGS_AUDIT, and DB_MIGRATIONS are aligned with the new behavior.

---

## Recommendations

### 1. **UX: Visible feedback when assume-role fails (high impact for non-tech users)**

**Issue:** If “Act as Board” / “Act as ARB” / “Drop role” fails (network, 403, etc.), the only feedback is `console.error`. Users may think nothing happened.

**Recommendation:** Show a short, non-intrusive message in the banner area when the assume-role request fails (e.g. “Couldn’t switch role. Please try again or refresh the page.”). Re-enable the button after failure so they can retry. Keep the message simple and avoid technical jargon.

---

### 2. **UX: Contextual hint on Dues when view-only (arb_board / admin)**

**Issue:** On Board → Dues, if the user is arb_board or admin and has *not* elevated, the “Record payment” column and “Add special assessment” section are hidden. The page looks like a normal dues list with no explanation.

**Recommendation:** When `effectiveRole === 'arb_board'` or `effectiveRole === 'admin'` and they are *not* acting in an assumed role, show a short notice at the top of the Dues content (e.g. “You’re viewing as ARB + Board. To record payments or add special assessments, use **Act as Board** in the banner above.”). Same idea can be applied on the ARB dashboard when they have view-only (“To approve or reject requests, use **Act as ARB** in the banner above.”). This reduces confusion for non-tech users who don’t immediately connect “banner” with “why can’t I click Record.”

---

### 3. **UX: Optional timeout countdown (lower priority)**

**Issue:** “Wait for timeout (2 hr)” is clear in text, but users don’t see how much time is left.

**Recommendation (optional):** If you want to reduce “why can’t I switch yet?” questions, you could add a small, non-intrusive label in the banner when acting in an assumed role, e.g. “Role expires in about 1h 45m” (using `session.assumed_until` and a rough client-side countdown). This is a nice-to-have, not required for correctness.

---

### 4. **Security: Restrict who can see assume-role audit**

**Current:** Board → Audit logs shows the “Admin assume role” section to any elevated user who can open that page.

**Recommendation:** If your policy is that only board (or board + admin) should see who assumed roles and when, add a check so that the “Admin assume role” block (and the data fetch for `listAdminAssumedRoleAudit`) is only run when `effectiveRole === 'board'` or `effectiveRole === 'admin'` (and optionally arb_board). Pure `arb` users would then not see that section. Align with your transparency vs. need-to-know policy.

---

### 5. **PII: Directory export and backups**

**Current:** Directory export and backup download are restricted to elevated roles; directory reveals are logged; backup refresh token is encrypted.

**Recommendation:** Keep directory export and backup access limited to roles that are allowed to manage directory/backups (as you have now). If you ever add “export audit log” or “download assume-role audit,” restrict that to board (or board + admin) and consider rate limiting. No change required for current code; just a note for future features.

---

### 6. **PII: Assume-role audit table**

**Current:** `admin_assumed_role_audit` stores `admin_email`, `actor_role`, `action`, `role_assumed`, `action_detail`, `ip_address`, `created`. This is appropriate for accountability and “who did what when.”

**Recommendation:** Keep as is. Avoid adding full PII (e.g. member names/emails) into `action_detail`; use identifiers (e.g. request_id, owner_email or a hash if you ever need to minimize PII in the log). Current use (e.g. “record_payment owner=… paymentId=…”) is a reasonable balance for audit. If you have a strict “minimize PII in logs” policy, you could trim `action_detail` to action type + ids only and keep full detail in a separate, access-controlled store.

---

### 7. **Small optimization: Avoid full reload after assume-role (optional)**

**Current:** After a successful assume-role API call, the page does `window.location.reload()` so the whole page reflects the new role.

**Recommendation:** For most users, reload is fine and keeps server and client in sync. If you later optimize for speed, you could update the banner and any role-dependent UI via the API response (e.g. `assumed_role` and `assumed_until`) and only reload when navigating to a different section. Not necessary for correctness or ease of use; only consider if you want to reduce full-page reloads.

---

### 8. **Documentation: One-page “how to” for ARB + Board and admins**

**Recommendation:** Add a short, non-technical doc (e.g. in `/docs` or linked from the portal/board area) that explains:
- For **ARB + Board:** “You have two roles. Choose **Act as Board** when recording payments or managing dues; choose **Act as ARB** when reviewing/approving ARB requests. Use **Drop role** or wait 2 hours before switching. All actions are logged.”
- For **Admins:** “You can view everything but only record payments or approve ARB requests after **Act as Board** or **Act as ARB**. Use **Return to Admin** when done. All actions are logged.”

This gives non-tech users and new board members a single place to read the rules and reduces support questions.

---

## Summary table

| Area              | Priority  | Action |
|-------------------|-----------|--------|
| Assume-role failure feedback | High     | Show inline message on failure; re-enable button |
| View-only hints (Dues/ARB)   | High     | Short “use Act as Board/ARB in the banner” when view-only |
| Timeout countdown            | Optional | “Role expires in ~X min” in banner |
| Audit visibility             | Policy   | Optionally restrict assume-role audit to board (and admin) |
| Assume-role audit PII        | Low      | Keep current; avoid extra PII in `action_detail` |
| No full reload               | Optional | Only if you want to avoid reload after assume-role |
| User-facing doc              | Medium   | One-page “how to” for ARB+Board and admins |

Overall, the recent updates are consistent with security and PII practices already in place. The highest-impact improvements for non-tech users are **visible feedback when assume-role fails** and **contextual hints on Dues and ARB when they are in view-only mode**.
