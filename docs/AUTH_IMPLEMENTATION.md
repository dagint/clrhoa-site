# Task: Implement Complete Authentication System for Portal

## Context
Building a private member portal for a publicly facing website. The portal must be completely private and restrict access to authenticated members only. Members have varying technical abilities, so the auth flow must be simple, familiar, and easy to self-service.

## Requirements

### 1. User Registration & Onboarding Flow
- Users are **pre-registered** by admins or board members in the directory
- Pre-registered users receive an email invitation to set up their account
- First-time setup: user clicks link → sets password → account activated
- Default role: `member` (assigned automatically on registration)
- Simple, familiar workflow (similar to common password setup flows)
- Clear instructions and helpful error messages for non-technical users

### 2. Core Authentication
- Email/password login system
- Use JWT tokens with 15-minute sliding window expiration
- Integrate Lucia for session management
- All portal routes must be protected (authenticated users only)
- "Remember me" option for longer sessions (optional but helpful for less tech-savvy users)

### 3. Multi-Factor Authentication (MFA)
- TOTP-based MFA that users can toggle on/off
- Store MFA secrets encrypted in KV storage
- Generate QR codes for MFA setup with clear instructions
- Require MFA verification during login when enabled
- Optional backup codes for MFA recovery
- **Make MFA optional** - don't force it on non-technical members

### 4. Role-Based Access Control (RBAC)
Four role levels:
- `member` - default role, basic access
- `arb` - elevated permissions
- `board` - board member access
- `admin` - full administrative access

**Role Assignment Permissions:**
- **Admin** can assign: `admin`, `board`, `arb`, or `member`
- **Board** can assign: `board`, `arb`, or `member` (NOT admin)
- **ARB** cannot assign roles
- **Member** cannot assign roles

**Implementation:**
- Middleware to check role permissions before role assignment
- Prevent privilege escalation (users can't assign roles higher than their own)
- Audit log for role changes (who changed what, when)

### 5. Password Management

**Password Setup (First Time):**
- Admin/Board creates user account with email
- System sends setup email with secure token link
- User clicks link → simple password creation form
- Token expires after 24-48 hours
- Clear instructions: "Create a password (at least 8 characters)"
- Password strength indicator (visual, not blocking)
- Confirmation step: "Password created! You can now log in."

**Password Reset (Self-Service):**
- Prominent "Forgot Password?" link on login page
- User enters email → receives reset link
- Reset link valid for 1-2 hours
- Simple reset form: "Enter new password"
- Success message: "Password updated! Please log in."
- Rate limiting: max 3 reset requests per hour per email

**Password Update (Logged In):**
- Simple form in user settings/profile
- Requires current password for security
- New password + confirmation field
- Clear success feedback

**Security & Rate Limiting:**
- Rate limit login attempts: 5 attempts per 15 minutes per email
- Rate limit password reset requests: 3 per hour per email
- Rate limit password setup links: prevent spam to new user emails
- Password hashing with bcrypt or argon2
- Secure token generation for password setup/reset (cryptographically random)

### 6. User Management (Admin/Board)

**Creating New Users:**
- Admin/Board can create user accounts via admin panel
- Required fields: email, role (default: member)
- Optional fields: name, phone, notes
- System automatically sends password setup email
- Option to resend setup email if user doesn't receive it

**User List View (Admin/Board):**
- Paginated table with sortable columns:
  - Email address
  - Name
  - Role (member, arb, board, admin)
  - Status (active, inactive, pending_setup, locked)
  - Last login (timestamp + "X days ago")
  - Password age (days since password_changed_at, warn if > 90 days)
  - MFA enabled (yes/no)
  - Failed login attempts (show if > 0)
- Search/filter by:
  - Email (partial match)
  - Role (dropdown)
  - Status (dropdown)
  - MFA enabled (yes/no)
  - Password age (> 90 days, > 180 days, never changed)
  - Last login (within 7 days, 30 days, 90 days, never)
- Bulk actions:
  - Export user list to CSV (email, name, role, status, last_login)
  - Select multiple users for deactivation
- Visual indicators:
  - 🔒 Locked accounts (locked_until in future)
  - ⚠️ Stale passwords (> 180 days old)
  - 🆕 Never logged in
  - 🔐 MFA enabled

**User Detail/Edit Modal (Admin/Board):**
- View user information:
  - Email, name, phone
  - Role and status
  - Created date and created_by
  - Last login: timestamp, IP address, user agent
  - Password changed: timestamp, age in days
  - MFA status: enabled/disabled, enabled_at
  - Failed login attempts: count, last_failed_login
  - Account lockout: locked_until (if applicable)
  - Active sessions: count, list with IP/user agent
- Actions available:
  - Update role (with permission checks, see RBAC rules)
  - Activate/deactivate account (toggle status)
  - Force password reset on next login (checkbox + reason)
  - Manually trigger password reset email
  - Unlock account (clear locked_until, reset failed_login_attempts)
  - Revoke all active sessions (force logout everywhere)
  - Reset MFA (disable + clear secret, notify user)
  - Resend password setup email (if status = pending_setup)
  - View login history (last 30 logins with IP/timestamp)
  - View audit log (all actions affecting this user)
- Confirmation dialogs for destructive actions:
  - Deactivating account: "This will immediately log out the user and prevent login. Continue?"
  - Forcing password reset: "User will be required to change password on next login. Reason for reset?"
  - Revoking sessions: "User will be logged out of all devices. Continue?"
  - Resetting MFA: "User will need to reconfigure MFA. Send notification email?"

**Force Password Reset:**
- Admin/Board can require password change on next login
- Reasons (dropdown + optional notes):
  - Security incident / compromise suspected
  - Policy compliance (routine rotation)
  - Account recovery / support request
  - Role change requiring re-authentication
  - Custom reason (free text)
- When user logs in with password_reset_required = 1:
  - Redirect to /auth/force-password-change (cannot access portal)
  - Display reason: "Your administrator has requested you change your password. Reason: [reason]"
  - User sets new password (must pass validation, cannot reuse last 5)
  - Clear password_reset_required flag
  - Log event: password_reset_completed (forced)
  - Send confirmation email to user and admin

**Password Policy Management (Admin Only):**
- View current password policy:
  - Minimum length (default: 12 characters)
  - Complexity requirements (uppercase, lowercase, number, special)
  - Password history (default: last 5 passwords blocked)
  - Expiration policy (optional: force reset every X days)
  - Common password blacklist (built-in list + custom additions)
- Customize policy (admin only, stored in database):
  - Adjust minimum length (8-32 characters)
  - Toggle complexity requirements (each rule on/off)
  - Set password history length (0-10 previous passwords)
  - Set expiration days (0 = never, 30-365 days)
  - Add custom blacklisted passwords (HOA name, property names, etc.)
- Preview password strength with examples:
  - Show validation for sample passwords
  - Display strength meter visualization
  - Test against current policy settings
- Audit log for policy changes:
  - Who changed policy, when
  - Old vs new settings (diff)
  - Affected user count (users who need to update)

**Account Security Dashboard (Admin Only):**
- Security metrics:
  - Users with weak/old passwords (> 180 days)
  - Users with MFA disabled (count + percentage)
  - Failed login attempts (last 24 hours, 7 days)
  - Locked accounts (currently locked count)
  - Pending password resets (count)
  - Active sessions (total across all users)
- Risk indicators:
  - Users who never logged in (potential compromised invites)
  - Users with repeated failed logins (potential brute force targets)
  - Users logged in from multiple IPs simultaneously (potential sharing)
- Quick actions:
  - Force MFA enrollment for all users (optional, sends instructions)
  - Expire all sessions (force re-login for all users)
  - Export security report (CSV with user security status)

### 7. Security Requirements
- Rate limiting on login attempts (5 per 15 min)
- Rate limiting on password reset requests (3 per hour)
- Rate limiting on password setup emails (prevent spam)
- Secure token generation (crypto.randomBytes or equivalent)
- Email verification tokens expire appropriately
- CSRF protection on all forms
- Secure session handling
- Account lockout after repeated failed login attempts (optional)
- Audit logging for sensitive actions (role changes, admin actions)

### 8. User Experience (UX) Priorities
**For Non-Technical Users:**
- Simple, clean forms with minimal fields
- Clear labels and helpful placeholder text
- Friendly error messages (not technical jargon)
- Visual feedback for success/error states
- Password visibility toggle (eye icon)
- Password strength indicator (visual progress bar)
- "What's this?" help text where needed (e.g., for MFA)
- Mobile-responsive design (many users on phones/tablets)

**Email Communications:**
- Clear, professional email templates
- Subject lines: "Set up your account", "Reset your password"
- Simple instructions with numbered steps
- Prominent CTA button (not just a link)
- Support contact info in footer
- Sender name: organization name (not noreply@)

### 9. Technical Constraints
- Use Lucia for authentication framework
- Store MFA secrets encrypted in KV
- JWT sliding window: 15 minutes
- Password setup/reset tokens: cryptographically secure
- Email delivery service integration
- Database/storage for user accounts and roles

## Deliverables

### API Endpoints
**Public (Unauthenticated):**
- POST /auth/login - email/password login
- POST /auth/forgot-password - request password reset
- POST /auth/reset-password - reset password with token
- POST /auth/setup-password - first-time password setup with token
- POST /auth/refresh - refresh JWT token

**Protected (Authenticated):**
- POST /auth/logout - logout current session
- PUT /auth/password - update password (requires current password)
- GET /auth/me - get current user info
- POST /auth/mfa/setup - initialize MFA setup
- POST /auth/mfa/verify - verify and enable MFA
- POST /auth/mfa/disable - disable MFA
- POST /auth/mfa/login-verify - verify MFA code during login

**Admin/Board Only:**
- POST /api/admin/users - create new user (send setup email)
- GET /api/admin/users - list all users (with filters, sorting, pagination)
- GET /api/admin/users/:email - get user details (full profile + login history)
- PUT /api/admin/users/:email/role - update user role (check permissions)
- PUT /api/admin/users/:email/status - activate/deactivate user
- POST /api/admin/users/:email/resend-setup - resend password setup email
- POST /api/admin/users/:email/force-password-reset - require password change on next login
- POST /api/admin/users/:email/trigger-reset - send password reset email to user
- POST /api/admin/users/:email/unlock - unlock account (clear lockout)
- POST /api/admin/users/:email/revoke-sessions - force logout (revoke all sessions)
- POST /api/admin/users/:email/reset-mfa - disable MFA and clear secret
- GET /api/admin/users/:email/login-history - get login history (last 30)
- GET /api/admin/users/:email/audit-log - get audit events for user
- GET /api/admin/users/export - export user list as CSV

**Admin Only (Password Policy & Security):**
- GET /api/admin/password-policy - get current password policy
- PUT /api/admin/password-policy - update password policy settings
- POST /api/admin/password-policy/test - test password against current policy
- GET /api/admin/security/dashboard - get security metrics and risk indicators
- POST /api/admin/security/expire-all-sessions - force all users to re-login
- GET /api/admin/security/report - generate security audit report (CSV)

### Middleware
- requireAuth() - verify JWT, attach user to request
- requireRole(['admin']) - admin-only routes
- requireRole(['admin', 'board']) - admin or board routes
- requireRole(['admin', 'board', 'arb']) - elevated access
- rateLimitLogin() - limit login attempts
- rateLimitPasswordReset() - limit reset requests

### Database Schema
User {
  email: string (primary key, indexed)
  name: string (nullable)
  phone: string (nullable)
  role: 'member' | 'arb' | 'board' | 'arb_board' | 'admin'
  status: 'pending_setup' | 'active' | 'inactive'

  // Password fields
  password_hash: string (nullable until setup)
  password_changed_at: timestamp (nullable)
  previous_password_hashes: string (JSON array, last 5 hashes)
  password_reset_required: boolean (default false)
  password_reset_reason: string (nullable)

  // MFA fields
  mfa_enabled: boolean (default false)
  mfa_secret: string (encrypted, nullable, stored in KV)
  mfa_enabled_at: timestamp (nullable)

  // Security tracking
  failed_login_attempts: integer (default 0)
  last_failed_login: timestamp (nullable)
  locked_until: timestamp (nullable)

  // Login tracking
  last_login: timestamp (nullable)
  last_login_ip: string (nullable)
  last_login_user_agent: string (nullable)

  // Audit fields
  created_at: timestamp (default CURRENT_TIMESTAMP)
  created_by: string (email of creator, nullable)
  updated_at: timestamp (nullable)
  updated_by: string (email of updater, nullable)

  // Indexes
  INDEX idx_users_role (role)
  INDEX idx_users_status (status)
  INDEX idx_users_email (email)
}

PasswordPolicy {
  id: integer (primary key, always 1 - single row)
  min_length: integer (default 12)
  require_uppercase: boolean (default true)
  require_lowercase: boolean (default true)
  require_number: boolean (default true)
  require_special: boolean (default true)
  password_history_count: integer (default 5, max 10)
  password_expiry_days: integer (default 0 = never)
  custom_blacklist: string (JSON array of custom banned passwords)
  updated_at: timestamp
  updated_by: string (admin email)
}

PasswordResetToken {
  id: string (uuid)
  user_id: string (foreign key)
  token: string (hashed, indexed)
  expires_at: timestamp
  used: boolean
  created_at: timestamp
}

PasswordSetupToken {
  id: string (uuid)
  user_id: string (foreign key)
  token: string (hashed, indexed)
  expires_at: timestamp
  used: boolean
  created_at: timestamp
}

Session {
  id: string
  user_id: string (foreign key)
  expires_at: timestamp
  created_at: timestamp
}

AuditLog {
  id: string (uuid)
  user_id: string (who performed action)
  target_user_id: string (who was affected, nullable)
  action: string ('role_change', 'user_created', 'password_reset', etc.)
  details: json
  timestamp: timestamp
}

### Email Templates
1. **Password Setup (New User)**
   - Subject: "Set up your [Organization] portal account"
   - Friendly welcome message
   - Clear CTA: "Set Up Your Password"
   - Link expires in 48 hours
   - Support contact info

2. **Password Reset**
   - Subject: "Reset your [Organization] password"
   - Acknowledges reset request
   - Clear CTA: "Reset Password"
   - Link expires in 2 hours
   - "Didn't request this?" message

3. **Password Reset Confirmation**
   - Subject: "Your password has been changed"
   - Confirms successful password change
   - "If this wasn't you, contact support immediately"

4. **Role Change Notification**
   - Subject: "Your account role has been updated"
   - Explains new role and permissions
   - Who made the change (admin/board member)

5. **Forced Password Reset**
   - Subject: "Password change required for your account"
   - Explains administrator has requested password change
   - Reason for reset (security, compliance, etc.)
   - Instructions: "Log in to change your password"
   - Support contact if questions

6. **Account Deactivated**
   - Subject: "Your account has been deactivated"
   - Explains account is no longer active
   - Contact administrator to reactivate
   - Support email/phone

7. **Account Reactivated**
   - Subject: "Your account has been reactivated"
   - Welcomes user back
   - Password reset link if needed
   - Any changes since deactivation

8. **MFA Disabled by Admin**
   - Subject: "Two-factor authentication has been disabled"
   - Explains admin disabled MFA (support request, security incident, etc.)
   - Instructions to re-enable if desired
   - Security notice to contact support if unexpected

9. **All Sessions Revoked**
   - Subject: "You have been logged out of all devices"
   - Explains forced logout (security measure, admin action, etc.)
   - Instructions to log back in
   - Password reset link if needed

### Frontend Components

**Public (Unauthenticated):**
- Login form (email, password, remember me, MFA code if enabled)
- Forgot password form (email input, rate limited)
- Password reset form (new password + confirm, token validation)
- Password setup form (first-time users, new password + confirm)

**User (Authenticated):**
- User profile page (view/edit name, phone, email)
- Change password form (current password + new password + confirm)
- MFA setup wizard (QR code, verification, backup codes)
- MFA disable confirmation (requires password)

**Admin/Board (User Management):**
- User list table:
  - Sortable columns (email, name, role, status, last login, password age, MFA)
  - Search/filter controls (email, role, status, password age, last login)
  - Pagination controls (50, 100, 200 per page)
  - Bulk actions toolbar (deactivate, export CSV)
  - Visual status indicators (locked, stale password, never logged in, MFA enabled)
- Create user modal:
  - Form fields (email, name, phone, role)
  - Send setup email checkbox (default true)
  - Validation and error display
  - Success confirmation with next steps
- User detail/edit modal:
  - User information tabs:
    - Overview: basic info, role, status, created/updated dates
    - Security: password age, MFA status, failed logins, lockout status
    - Sessions: active sessions list (IP, user agent, created)
    - History: login history table (last 30 logins)
    - Audit: audit log table (all actions affecting user)
  - Action buttons (contextual based on user status):
    - Update role (dropdown with permission validation)
    - Activate/Deactivate toggle
    - Force password reset (checkbox + reason input)
    - Send password reset email
    - Unlock account (if locked)
    - Revoke all sessions
    - Reset MFA (if enabled)
    - Resend setup email (if pending)
  - Confirmation dialogs for destructive actions
  - Real-time validation and error display

**Admin Only (Password Policy & Security):**
- Password policy settings page:
  - Current policy display (visual card layout)
  - Edit policy form:
    - Minimum length slider (8-32)
    - Complexity checkboxes (uppercase, lowercase, number, special)
    - History count slider (0-10)
    - Expiry days input (0 = never, 30-365)
    - Custom blacklist textarea (one per line)
  - Password tester:
    - Input field for test password
    - Real-time strength meter
    - Validation messages (pass/fail for each rule)
    - Common password detection
  - Save/cancel buttons with confirmation
  - Audit log of policy changes
- Security dashboard:
  - Metrics cards (stale passwords, MFA disabled, failed logins, locked accounts)
  - Risk indicators table (users at risk, sorted by severity)
  - Charts (login attempts over time, MFA adoption, password age distribution)
  - Quick action buttons (expire all sessions, export report)
  - Filter controls (date range, severity level)

**Forced Password Change Flow:**
- Intercept login redirect (if password_reset_required = true)
- Display forced password change page:
  - Explanation message with admin-provided reason
  - Cannot access portal until password changed
  - Password change form (new password + confirm)
  - Validation against current policy
  - Check password history (cannot reuse last 5)
  - Submit button
- On success:
  - Clear password_reset_required flag
  - Log event to audit log
  - Redirect to portal dashboard
  - Show success message

## Implementation Steps

### Phase 1: Core Auth
1. Set up Lucia integration
2. Create user model and database schema
3. Implement login/logout endpoints
4. Implement JWT with 15-min sliding window
5. Create auth middleware (requireAuth, requireRole)
6. Protect all portal routes

### Phase 2: User Registration & Password Setup
1. Create password setup token system
2. Build user creation endpoint (admin/board only)
3. Implement password setup email template
4. Build password setup form and endpoint
5. Add token expiration and validation
6. Add rate limiting on setup emails

### Phase 3: Password Reset (Self-Service)
1. Create password reset token system
2. Build forgot password endpoint
3. Implement password reset email template
4. Build reset password form and endpoint
5. Add rate limiting (3 per hour)
6. Test full reset flow

### Phase 4: Role Management
1. Implement role-based permission checks
2. Build role assignment endpoint with permission validation
3. Create audit logging for role changes
4. Add role change notifications
5. Build admin/board user management UI

### Phase 5: MFA (Optional)
1. Implement TOTP generation and verification
2. Build MFA setup flow (QR code generation)
3. Store encrypted MFA secrets in KV
4. Add MFA verification to login flow
5. Create MFA toggle in user settings
6. Generate backup codes (optional)

### Phase 6: Enhanced Admin Panel
1. Build password policy management:
   - Create password_policy table and migration
   - Implement policy CRUD endpoints
   - Build policy settings UI
   - Integrate policy validation into password checks
   - Add policy change audit logging
2. Implement forced password reset:
   - Add password_reset_required and password_reset_reason columns
   - Build force-password-reset endpoint
   - Create forced password change interceptor (middleware)
   - Build forced password change UI
   - Add email notification template
3. Build user list enhancements:
   - Add sorting, filtering, pagination
   - Display password age, MFA status, failed logins
   - Add visual indicators (locked, stale, never logged in)
   - Implement CSV export
   - Add bulk actions (deactivate multiple)
4. Enhance user detail modal:
   - Add security tab (password age, MFA, lockout status)
   - Add sessions tab (active sessions list)
   - Add history tab (login history table)
   - Add audit tab (audit log for user)
   - Add action buttons (unlock, revoke sessions, reset MFA)
   - Add confirmation dialogs for destructive actions
5. Build security dashboard:
   - Create metrics aggregation queries
   - Build dashboard UI (cards, charts, tables)
   - Implement risk indicators
   - Add export security report feature
   - Add quick actions (expire all sessions)
6. Add new email templates:
   - Forced password reset notification
   - Account deactivated notification
   - Account reactivated notification
   - MFA disabled by admin notification
   - All sessions revoked notification
7. Add admin action audit logging:
   - Log forced password resets
   - Log account activations/deactivations
   - Log session revocations
   - Log MFA resets
   - Log password policy changes

### Phase 7: Testing & Polish
1. Test all auth flows end-to-end
2. Test role permission boundaries
3. Test rate limiting effectiveness
4. Test email delivery
5. Test admin panel features:
   - User management CRUD operations
   - Password policy enforcement
   - Forced password reset flow
   - Security dashboard metrics
   - Audit logging completeness
6. UX testing with non-technical users
7. Mobile responsiveness testing
8. Security audit
9. Performance testing (user list pagination, large datasets)

## Security Checklist

**Authentication & Sessions:**
- [ ] Passwords hashed with bcrypt (cost factor 10+)
- [ ] Password history prevents reuse of last 5 passwords
- [ ] Password policy enforced (min 12 chars, complexity rules)
- [ ] MFA secrets encrypted at rest in KV
- [ ] All tokens cryptographically random (32+ bytes)
- [ ] Password setup tokens expire (24-48 hours)
- [ ] Password reset tokens expire (1-2 hours)
- [ ] Session tokens have proper expiration (15 min idle timeout)
- [ ] Session fingerprinting detects hijacking
- [ ] Secure session cookie settings (httpOnly, secure, sameSite)
- [ ] Token URLs use HTTPS only

**Rate Limiting & Lockout:**
- [ ] Rate limiting on login (5 per 15 min)
- [ ] Rate limiting on password reset (3 per hour)
- [ ] Rate limiting on password setup emails
- [ ] Account lockout after 5 failed login attempts (15 min)
- [ ] Admin can manually unlock accounts
- [ ] Failed login attempts tracked and logged

**Authorization & RBAC:**
- [ ] Admin routes restricted to admin role only
- [ ] Board routes restricted to admin+board only
- [ ] Role assignment permission checks enforced (cannot escalate)
- [ ] Board cannot assign admin role
- [ ] Admin cannot be demoted except by another admin
- [ ] Forced password reset requires admin/board role
- [ ] Password policy changes require admin role only
- [ ] Session revocation requires admin/board role

**Audit Logging:**
- [ ] Audit logging for all sensitive actions
- [ ] Role changes logged (who, what, when)
- [ ] Password resets logged (forced, self-service)
- [ ] Account activations/deactivations logged
- [ ] Session revocations logged
- [ ] MFA changes logged (enable, disable, reset)
- [ ] Password policy changes logged
- [ ] Failed login attempts logged
- [ ] Audit logs retained for 365 days (configurable)

**Input Validation & Injection Prevention:**
- [ ] CSRF protection enabled on all forms
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize outputs, CSP headers)
- [ ] Email validation (format, domain checks)
- [ ] Password validation (strength, history, blacklist)
- [ ] File upload validation (if implemented)

**Data Protection:**
- [ ] Email templates don't expose sensitive info
- [ ] Different error messages for valid/invalid users (prevent enumeration)
- [ ] PII masked in logs (emails, IPs redacted)
- [ ] Password hashes never exposed in API responses
- [ ] Session tokens never logged
- [ ] MFA secrets never exposed
- [ ] Audit logs exclude sensitive payload data

**Admin Panel Security:**
- [ ] Admin actions require re-authentication for destructive operations
- [ ] Confirmation dialogs for account deactivation
- [ ] Confirmation dialogs for session revocation
- [ ] Confirmation dialogs for MFA reset
- [ ] Confirmation dialogs for password policy changes
- [ ] Admin cannot lock themselves out (prevent self-deactivation)
- [ ] Last admin cannot be demoted (maintain admin access)
- [ ] CSV exports sanitized (prevent formula injection)
- [ ] User list pagination prevents DoS (max 200 per page)
- [ ] Security dashboard metrics use read-only queries

## UX Checklist (Non-Technical Users)

**General UX:**
- [ ] Forms have clear, simple labels
- [ ] Error messages are friendly and actionable
- [ ] Success states have clear visual feedback
- [ ] Password visibility toggle on all password fields
- [ ] Password strength indicator (visual, real-time)
- [ ] Mobile-responsive design (all breakpoints)
- [ ] Large, tappable buttons on mobile
- [ ] Email templates are clear and professional
- [ ] Setup/reset flows work in 3 steps or less
- [ ] Help text available where needed ("What's this?" tooltips)
- [ ] Support contact info easily accessible
- [ ] Tested with real non-technical users

**Admin Panel UX:**
- [ ] User list loads quickly (< 2 seconds for 1000 users)
- [ ] Search/filter is intuitive (dropdown + text input)
- [ ] Sorting is clear (arrow indicators on columns)
- [ ] Pagination controls are obvious (prev/next, page numbers)
- [ ] Visual indicators are self-explanatory (🔒 = locked, ⚠️ = warning)
- [ ] Action buttons have clear labels ("Deactivate", not "Toggle status")
- [ ] Destructive actions require confirmation (modal dialogs)
- [ ] Confirmation dialogs explain consequences clearly
- [ ] Bulk actions are easy to select (checkboxes + toolbar)
- [ ] CSV export is fast and clearly labeled
- [ ] User detail modal is organized (tabs for different info)
- [ ] Modal closes easily (X button, ESC key, click outside)
- [ ] Forms save progress (prevent data loss on accidental close)
- [ ] Loading states are clear (spinners, skeleton screens)
- [ ] Error states are helpful (retry button, support link)

**Forced Password Reset UX:**
- [ ] Reason is clearly displayed ("Your admin requested...")
- [ ] Cannot bypass (all other portal pages redirect back)
- [ ] Password requirements shown upfront (before typing)
- [ ] Validation is real-time (instant feedback)
- [ ] Cannot reuse old passwords (clear error message)
- [ ] Success message confirms completion ("You can now access portal")
- [ ] Auto-redirects to portal after success (3 second delay)

**Password Policy UX:**
- [ ] Current policy is easy to understand (visual cards)
- [ ] Edit form is intuitive (sliders, checkboxes)
- [ ] Tester shows real-time validation (green/red indicators)
- [ ] Preview explains impact ("X users will need to update")
- [ ] Save confirmation warns about user impact
- [ ] Changes take effect immediately (clear messaging)

**Security Dashboard UX:**
- [ ] Metrics are at-a-glance (big numbers, visual indicators)
- [ ] Charts are simple and clear (no clutter)
- [ ] Risk indicators are actionable (click to view users)
- [ ] Date range filters are obvious (calendar picker)
- [ ] Export buttons are clearly labeled (CSV icon + text)
- [ ] Quick actions have confirmation dialogs
- [ ] Dashboard refreshes automatically (every 5 minutes)
- [ ] Loading states don't block interaction

## Notes for Claude Code
- Prioritize simplicity and clarity in the UX
- Use familiar patterns (similar to major sites like Gmail, Facebook password reset)
- Add helpful comments in code for future maintenance
- Consider accessibility (WCAG 2.1 AA)
- Test with actual non-technical users if possible
- Provide clear error messages, not technical stack traces
- do not over expose secure information publicly (give different errors for valid and invalid users for things like password updates.)
- Make password reset the easiest possible self-service flow

Please implement this step-by-step, starting with Phase 1 (Core Auth), ensuring each component is secure and user-friendly before moving to the next phase.

---

## Pull Request Roadmap

The implementation is split into reviewable PRs that build on each other:

### Infrastructure (Completed)
- ✅ **PR #1**: Database Schema - Users, sessions, tokens tables
- ✅ **PR #2**: Audit Logging - Security event tracking (365 day retention)
- ✅ **PR #59**: Database Consolidation - Organized schemas (core/rbac/features/auth)
- ✅ **PR #60**: Rate Limiting & Security - Brute force protection, password validation
- ✅ **PR #61**: Password Hashing - bcrypt implementation, password history (last 5)
- ✅ **PR #62**: Lucia Integration - Session management, auth middleware

### Core Authentication (In Progress)
- ⏳ **PR #6**: Email/Password Login & Logout - Replace whitelist-only auth with password-based
- ⏳ **PR #7**: Password Setup Flow - New user onboarding, setup tokens, email templates
- ⏳ **PR #8**: Password Reset Flow - Self-service password recovery, reset tokens
- ⏳ **PR #9**: Auth Middleware Integration - Wire Lucia into Astro middleware, protect all portal routes

### User Management (Planned)
- 📋 **PR #10**: Basic User Management - Admin/board can create/view/edit users, role assignment
- 📋 **PR #11**: Enhanced Admin Panel - User list with sorting/filtering, CSV export, bulk actions
- 📋 **PR #12**: User Detail Modal - Security tab, sessions tab, login history, audit log
- 📋 **PR #13**: Forced Password Reset - Admin can require password change on next login
- 📋 **PR #14**: Password Policy Management - Customizable policy settings, password tester
- 📋 **PR #15**: Security Dashboard - Metrics, risk indicators, security reports

### Advanced Features (Planned)
- 📋 **PR #16**: MFA Implementation - TOTP setup, QR codes, backup codes, MFA enforcement
- 📋 **PR #17**: Frontend Auth UI - Login forms, password reset forms, user-facing components
- 📋 **PR #18**: Email Templates - Professional email templates for all auth events

### Testing & Deployment (Planned)
- 📋 **PR #19**: E2E Testing - Playwright tests for all auth flows
- 📋 **PR #20**: Security Audit & Polish - Penetration testing, accessibility, performance

**Total Estimated PRs**: 20 (6 completed, 14 remaining)

---

## Database Schema Summary

### Required Migrations

**Already Exists** (schema-core.sql, schema-auth.sql):
- `users` table - All auth fields included
- `sessions` table - Lucia session storage
- `password_reset_tokens` table - Reset tokens
- `password_setup_tokens` table - Setup tokens
- `audit_logs` table - Audit trail (365 days)
- `security_events` table - Security monitoring (730 days)
- `login_history` table - Login tracking
- `rate_limits` table - Rate limit tracking

**New Migration Required** (PR #14):
```sql
-- Password policy table
CREATE TABLE IF NOT EXISTS password_policy (
  id INTEGER PRIMARY KEY DEFAULT 1,
  min_length INTEGER DEFAULT 12,
  require_uppercase INTEGER DEFAULT 1,
  require_lowercase INTEGER DEFAULT 1,
  require_number INTEGER DEFAULT 1,
  require_special INTEGER DEFAULT 1,
  password_history_count INTEGER DEFAULT 5,
  password_expiry_days INTEGER DEFAULT 0,
  custom_blacklist TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT NULL,
  CHECK (id = 1)  -- Ensure single row
);

-- Seed default policy
INSERT INTO password_policy (id) VALUES (1)
  ON CONFLICT(id) DO NOTHING;
```

**Column Additions Required** (PR #13):
```sql
-- Add forced password reset columns to users table
ALTER TABLE users ADD COLUMN password_reset_required INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN password_reset_reason TEXT DEFAULT NULL;
```

---

## Notes for Implementation

### Priority Order
1. **Core Auth First** (PR #6-9) - Replace old whitelist system, establish password-based auth
2. **Basic User Management** (PR #10) - Admin can manage users, assign roles
3. **Enhanced Admin Features** (PR #11-15) - Detailed user info, forced resets, policy management
4. **MFA & Polish** (PR #16-20) - Advanced security, email templates, testing

### Technical Decisions
- **Session Management**: Lucia v3 (deprecated but functional, can migrate to Oslo.js later)
- **Password Hashing**: bcrypt with cost factor 10 (2^10 = 1,024 rounds)
- **Session Timeout**: 15 minutes idle (sliding window)
- **Password History**: Last 5 passwords blocked
- **Rate Limiting**: 5 login attempts per 15 minutes
- **Account Lockout**: 15 minutes after 5 failed attempts
- **Password Policy**: Customizable via database (single row table)

### Security Considerations
- Admin cannot lock themselves out (self-deactivation prevented)
- Last admin cannot be demoted (maintain admin access)
- Destructive actions require confirmation dialogs
- Audit logs for all sensitive operations
- CSV exports sanitized (prevent formula injection)
- Email enumeration prevented (generic error messages)
- PII masked in logs (emails, IPs redacted)

### UX Priorities
- Simple, familiar flows (similar to Gmail, Facebook)
- Mobile-first responsive design
- Clear error messages (no technical jargon)
- Password strength indicator (real-time visual feedback)
- Confirmation dialogs explain consequences
- Help text for non-technical users ("What's this?" tooltips)
- Professional email templates with clear CTAs
