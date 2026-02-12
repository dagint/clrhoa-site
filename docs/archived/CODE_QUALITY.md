# Code Quality Guide

Ways to raise and maintain code quality across the public site and portal.

## What’s in place

### Shared API helpers (`src/lib/api-helpers.ts`)

- **`jsonResponse(data, status)`** — Build JSON responses with a consistent `Content-Type`.
- **`requireSession(ctx)`** — Get session from the request or a 401 Response. Use in API routes to avoid repeating cookie/secret/401 logic.
- **`requireDb(env)`** — Ensure `env.DB` exists or return a 503 Response.

**Example (API route):**

```ts
const auth = await requireSession(Astro);
if (auth.response) return auth.response;
const { session } = auth;

const dbResult = requireDb(Astro.locals.runtime?.env);
if (dbResult.response) return dbResult.response;
const { db } = dbResult;
// ... use session and db
return jsonResponse(result);
```

Migrate other API routes to these helpers over time to reduce duplication and keep behavior consistent.

### Unit tests (Vitest)

- **`tests/sanitize.test.ts`** — `escapeHtml`, `sanitizeText`, `sanitizeFileName`, `sanitizeEmail`, `sanitizePhone`, `sanitizeForScriptInjection`.
- **`tests/auth.test.ts`** — `isElevatedRole`, `ELEVATED_ROLES`, `VALID_ROLES`, `generateSessionFingerprint`, `verifySessionFingerprint`.
- **`tests/api-helpers.test.ts`** — `jsonResponse`, `requireDb`.

Run: `npm test` (watch) or `npm test -- --run`.

## Recommendations

### 1. Migrate more API routes to `api-helpers`

Use `requireSession`, `requireDb`, and `jsonResponse` in:

- `/api/preapproval`, `/api/meetings`, `/api/feedback`, `/api/maintenance-submit`, etc.

Pattern: replace local `jsonResponse` and manual session/DB checks with the shared helpers.

### 2. Add tests as you touch code

- **New or changed `lib/*.ts`** — Add or update tests in `tests/*.test.ts` (or colocate with Vitest `include` if you add `src/**/*.test.ts`).
- **Critical paths** — Auth, sanitize, and API response shapes are already covered; add tests for new DB helpers or search/session logic when you change them.

### 3. Lint (CI)

**`npm run lint`** runs `astro check` (TypeScript and Astro diagnostics). The **CI workflow** runs it on every push/PR to `main`; the build fails if lint fails. Fix new diagnostics as you touch files; clearing existing warnings can be done incrementally.

### 4. Portal context helper (`src/lib/portal-context.ts`)

Use **`getPortalContext(Astro)`** on portal pages so they don’t repeat runtime/cookie/session logic:

```ts
const { env, session } = await getPortalContext(Astro);
if (!session) return Astro.redirect('/portal/login');
const db = env?.DB;
// ... use session and db
```

Use **`getPortalContext(Astro, { fingerprint: true })`** when you want session validation with userAgent + IP (e.g. dashboard), with fallback to session without fingerprint if the first call fails.

### 5. Board context helper (`src/lib/board-context.ts`)

**Board pages** use **`getBoardContext(Astro)`**: it returns `{ env, session }` or `{ redirect }`. Do `if (ctx.redirect) return Astro.redirect(ctx.redirect);` then use `env` and `session`. Pages that need a stricter role (e.g. board-only for backups) check `session.role` after. Same idea as `getPortalContext` for portal.

### 6. Break up very long pages

If a page or API file grows past ~150–200 lines, consider:

- Moving data-fetching or business logic into `lib/*.ts`.
- Extracting UI sections into Astro components under `src/components/`.

### 7. Type safety

- **Env** — `src/env.d.ts` defines the `Env` interface used by `Astro.locals.runtime.env`. Keep it in sync with `wrangler.toml` (bindings) and any secrets set via `wrangler secret put`. The file includes a short comment to that effect.
- **DB helpers** — Lib modules use explicit return types and exported interfaces (e.g. `listPublicDocuments(db): Promise<PublicDocumentRow[]>`, `runPortalSearch(...): Promise<SearchResult>`). Use these types in pages so shapes stay consistent and refactors are safer.

### 8. Data & access control

See **[DATA_ACCESS_CONTROL.md](DATA_ACCESS_CONTROL.md)** for who can access what, what we log, and how to keep the public/portal/board boundary clear. Use **`requireArbRequestAccess`** / **`requireArbRequestOwner`** from `src/lib/access-control.ts` for any ARB API that takes a `requestId` so ownership is enforced in one place.

### 7. Linting and formatting

- Run the project linter/formatter before committing.
- Optionally add a pre-commit hook (e.g. `lint-staged`) to run `npm run lint` and `npm test -- --run` on changed files.

## Summary

- Use **api-helpers** for JSON and auth/DB in API routes.
- Add **unit tests** for new or changed lib code, especially auth and sanitize.
- Reduce duplication with shared **context helpers** for portal pages if the same pattern appears in many files.
- Keep **files and components** at a manageable size and keep **types** accurate in `env.d.ts` and DB layers.

## Reaching and keeping a 9+ rating

- **CI** — `.github/workflows/ci.yml` runs tests, **lint** (`npm run lint`), `npm audit --audit-level=high`, and build on every push/PR. Keep the build green.
- **Tests** — Maintain and extend unit tests in `tests/` (sanitize, auth, api-helpers, portal-context, arb-dashboard, access-control, rate-limit). For 9+ consider one or two E2E tests (e.g. login → dashboard) with Playwright.
- **Security** — Resolve or document any high/critical audit findings; keep SECURITY_ASSESSMENT and SECURITY_CHECKLIST up to date.
- **Docs** — Keep ARCHITECTURE.md and DATA_ACCESS_CONTROL.md in sync when you add routes or change auth/data rules.
