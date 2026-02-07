# KV rate limiting and login lockout

The portal uses **Cloudflare KV** (a single namespace bound as **`KV`** in `wrangler.toml`) for:

1. **API rate limiting** — per-IP limits on sensitive endpoints (CSV upload, directory reveal, ARB actions, login, etc.).
2. **Login lockout** — temporary lockout of an account after repeated failed login attempts.

Implementation lives in `src/lib/rate-limit.ts` (rate limits) and `src/lib/auth.ts` (lockout helpers). This doc describes setup, behavior, and operations.

---

## 1. Binding and setup

- **Namespace:** Create a dedicated KV namespace (e.g. `RATE_LIMIT`) and bind it as **`KV`** in `wrangler.toml`. It is **separate** from `CLOURHOA_USERS` (email whitelist).
- **Creation:**

  ```bash
  npx wrangler kv namespace create RATE_LIMIT
  ```

  Copy the printed **id** into `wrangler.toml` under the `KV` binding (replace `REPLACE_WITH_RATE_LIMIT_KV_ID`).

- **If `KV` is not bound** (or the id is missing), the app still runs; rate limits and login lockout are **not enforced** (graceful degradation). No errors are thrown; endpoints behave as if limits were not exceeded.

**Cloudflare Pages:** When deploying via Pages, attach the **same** KV namespace (the one whose id is in `KV`) to the Pages project so production has rate limiting and lockout. See **docs/PORTAL_SETUP.md** (section 4b).

---

## 2. How rate limiting works

- **Scope:** Per **IP address** and per **endpoint**. The client IP is taken from `cf-connecting-ip` or `x-forwarded-for` (first hop).
- **Storage:** For each (endpoint, IP) pair, the code uses a **sliding-window style** key:  
  `rate_limit:<endpoint>:<ip>:<windowStart>`, where `windowStart` is a time bucket in seconds. The value is the request count in that window.
- **TTL:** Keys are written with `expirationTtl: windowSeconds + 60` so KV drops them after the window plus a small buffer; no manual cleanup is required.
- **Behavior:**
  - On each request, the handler calls `checkRateLimit(kv, endpoint, ipAddress, maxRequests, windowSeconds)`.
  - If the current count for that window is below the limit, the request is allowed and the count is incremented.
  - If the limit is reached, the handler returns **429 Too Many Requests** (or equivalent) and does not run the endpoint logic.
- **Graceful degradation:** If `kv` is `undefined` or `ipAddress` is null, `checkRateLimit` returns `{ allowed: true, ... }` so the request proceeds.

---

## 3. Endpoints and limits

Configuration is in `src/lib/rate-limit.ts` (`RATE_LIMITS` and `getRateLimitConfig`). Current values:

| Endpoint | Limit | Window |
|----------|--------|--------|
| `/api/login` | 5 requests | 15 minutes |
| `/api/owners/upload-csv` | 10 requests | 1 hour |
| `/api/log-phone-view` | 60 requests | 1 minute |
| `/api/arb-upload` | 10 requests | 1 hour |
| `/api/arb-approve` | 100 requests | 1 minute |
| `/api/arb-update` | 20 requests | 1 minute |
| `/api/arb-cancel` | 10 requests | 1 minute |
| `/api/arb-remove-file` | 20 requests | 1 minute |
| `/api/arb-resubmit` | 10 requests | 1 minute |
| `/api/arb-notes` | 30 requests | 1 minute |
| `/api/arb-deadline` | 20 requests | 1 minute |
| `/api/arb-add-files` | 10 requests | 1 hour |
| `/api/arb-copy` | 10 requests | 1 minute |

Unknown endpoints use a default of **100 requests per minute** when a config exists for a matching prefix.

---

## 4. Login lockout (same KV)

Failed login attempts and lockout state are stored in the **same** `KV` namespace:

- **Keys:**  
  - `login_lockout:<email>` — lockout expiry (Unix timestamp); present only while the account is locked.  
  - `login_attempts:<email>` — failed-attempt count (resets after 1 hour or when lockout is applied).  
  - `login_ip:<email>` — last IP used for this email (1 hour TTL), for tracking.
- **Behavior:** After 5 failed attempts per email, the account is locked for 15 minutes. While locked, login returns an error and does not check the whitelist. Lockout and attempt count are cleared on successful login.
- **Details:** See `checkAccountLockout`, `recordFailedLoginAttempt`, `clearFailedLoginAttempts` in `src/lib/auth.ts` and usage in `src/pages/api/login.astro`.

---

## 5. Local vs remote

- **Local dev** (`npm run dev` / `npm run preview`): Uses the **local** KV bound to `KV` in wrangler. Run `npx wrangler kv namespace create RATE_LIMIT` and add a **local** namespace in `wrangler.toml` for development if you want to test rate limiting and lockout locally.
- **Production:** Uses the **remote** KV namespace whose id is set in `wrangler.toml` under the `KV` binding. For Pages, attach that same namespace in the dashboard.

---

## 6. Summary

| Item | Detail |
|------|--------|
| **Binding** | `KV` in `wrangler.toml` (namespace id = e.g. RATE_LIMIT id) |
| **Used for** | Rate limit counters (per endpoint + IP), login lockout state |
| **Key pattern (rate limit)** | `rate_limit:<endpoint>:<ip>:<windowStart>` |
| **Key pattern (lockout)** | `login_lockout:<email>`, `login_attempts:<email>`, `login_ip:<email>` |
| **If KV missing** | App runs; rate limits and lockout not enforced |
| **Config** | `src/lib/rate-limit.ts` (`RATE_LIMITS`, `getRateLimitConfig`) |

For initial setup steps, see **docs/PORTAL_SETUP.md** (sections 1 and 4b).
