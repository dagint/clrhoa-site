# PRIORITIZED TODO List (GitHub Projects Recommended)

## 1. Dark Mode Fixes ⭐⭐⭐⭐⭐
**Cursor Prompt:** `Fix dark mode: maintenance dropdown text contrast 4.5:1. Global CSS vars --text-primary-dark. Audit dropdowns/buttons/cards. Tailwind config.`

## 2. Auth + MFA + Password Management + Admin Controls ⭐⭐⭐⭐
**Cursor Prompt:** `Full auth: email/pass login/register. JWT 15min sliding. MFA TOTP toggle (encrypted KV). Roles user/elevated/admin. ADMINS ONLY assign admins. Password update/reset/forgot flows w/rate limiting. Lucia lib. Protect admin routes.`

## 3. Directory Lot Number Field ⭐⭐⭐⭐
**Cursor Prompt:** `User directory: add lot_number field alongside address. Update forms/login/profile display. Store in D1 schema. Admin view shows lot#→address mapping. Validation: 1-4 digits. Required for elevated role.`

## 4. Request Tabs ⭐⭐⭐
**Cursor Prompt:** `Tabbed requests like maintenance page: All|Pending|Processing|Complete|Failed. Red bubble count non-final. Detail view+timeline. SSE live updates. Match styling exactly. /requests`

## 5. Feedback Collector ⭐⭐⭐
**Cursor Prompt:** `Feedback widget every page: bottom-right→thumbs up/down+140char box. Collect URL/time/viewport/sessionID (noPII). Worker→D1. Admin /admin/feedback dashboard w/filters/CSV. Rate limit 3/day. Tailwind.`

## 6. PIM Elevation ⭐⭐
**Cursor Prompt:** `PIM: member→request elevated (2hr TTL admin approve). JIT session refresh. Audit D1. Banner expiry timer. User dashboard integration. Cloudflare D1.`

## 7. SMS Feature (Disabled + Request Tracking) ⭐⭐
**Cursor Prompt:** `SMS notifications: show locked UI to users "Request SMS (costs HOA money)". Track feature requests in D1 w/lot_number+timestamp. Admin report "X users want SMS". Disable actual sending. Note costs in UI.`

## 8. Usage Metrics Dashboard ⭐
**Cursor Prompt:** `Create a usage metrics dashboard for Cloudflare Pages/Astro: 1.Public: total views/users daily/weekly (anon) 2.Admin: user_id→pages→timestamps via session keys 3.Chart.js responsive 4.Cloudflare KV/D1 storage 5.Role access 6./dashboard page matching styling`
