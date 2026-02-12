# Member-Only Access (e.g. Private Google Drive)

This site is **static** (no server-side login). To give HOA members only access to a private Google Drive (or similar), you need either a separate auth layer or to avoid “member-only” on the website entirely.

## Option 1: Drive link by email (no website integration)

**How it works:** Keep a Google Drive folder (or Shared Drive) and share it only with member email addresses in Google Drive. Do **not** link to it from the public site. Share the link with members by:

- Email or newsletter
- A printed letter with the link and a short “keep this private” note
- After they contact the Board, send the link once you’ve confirmed they’re a member

**Pros:** No code, no OAuth, no list to sync.
**Cons:** No “Members only” area on the website; you manage access manually in Drive and by email.

---

## Option 2: Shared password page on the site

**How it works:** Add a page (e.g. `/members`) that asks for a password. If the password matches a value in an env var, the page shows a link to the Google Drive folder (also from env). No real “member list”—anyone with the password can open the link.

**Pros:** One place on the site for “member documents”; password can be changed via env and redeploy.
**Cons:** Weak security (shared secret; anyone who has it can share it). Good only for low-sensitivity material.

**Implementation:** Static page + client-side check of a password against a hash or simple secret; if correct, show the Drive URL. The “secret” would be in `PUBLIC_*` or in a client-side hash, so it’s not truly secret—treat as “casual” protection only.

---

## Option 3: Google sign-in + membership check (real member-only)

**How it works:**

1. Add a “Member documents” or “Member Drive” page that requires sign-in (e.g. “Sign in with Google”).
2. After sign-in, a **backend** (e.g. Cloudflare Worker, Vercel/Netlify serverless, or a small API) checks that the signed-in user’s email is in the allowed list (or in a Google Group that represents members).
3. If allowed, the backend either:
   - Redirects to a **time-limited Drive folder link** (e.g. created via Google Drive API with a short-lived permission), or
   - Returns a list of file links (or embed URLs) from a Drive folder via the Drive API.

**Pros:** Only people you list (or in the group) can access; no shared password.
**Cons:** Requires a backend/API, maintaining a member list or Google Group, and Google Cloud / Drive API setup (service account or OAuth).

**Rough pieces:**

- **Auth:** Google OAuth (e.g. “Sign in with Google” on the site).
- **Member list:** Spreadsheet, Google Group, or database of allowed emails; backend checks `user.email` against it.
- **Drive access:** Service account with access to the folder, or folder shared with a Google Group; backend uses Drive API to list files and generate view/download links or temporary links.
- **Where to run it:** e.g. Cloudflare Worker, or a small Node/Python API hosted elsewhere. This site stays static; the Worker/API handles `/api/auth` and `/api/member-docs` (or similar).

---

## Option 4: Third-party member area

Use a product that already does “member-only” content and can link to or embed Drive:

- **MemberSpace** (member area + payments)
- **Memberful** (memberships, often with Stripe)
- **Google Sites** with “Restricted to organization” (if you use Google Workspace and all members have org accounts—usually not the case for HOAs)

These replace or sit next to your static site and handle login and gating; you’d link from your site to “Member login” and then to Drive or embedded content.

---

## Recommendation for this HOA site

- **Minimal effort:** Use **Option 1** (private Drive folder, share only with member emails; don’t put the link on the public site). Use the contact form or newsletter to send the link to members.
- **Slightly more than static:** Use **Option 2** only if you’re okay with weak, shared-password protection and want a single “Member documents” page that reveals the Drive link.
- **Real “members only”:** Plan for **Option 3** (Google sign-in + backend that checks membership and then gives access to Drive links). That implies adding a small backend (e.g. Cloudflare Worker) and maintaining a member list or Google Group.

If you tell me which option you prefer (1, 2, or 3), I can outline concrete steps or, for Option 2, a simple password page and env vars for the Drive link.
