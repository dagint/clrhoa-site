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

**Managing Existing Users:**
- Admin/Board can view all users
- Admin/Board can update user roles (per permission rules above)
- Admin/Board can deactivate/reactivate accounts
- Admin/Board can manually trigger password reset for users
- Search/filter users by role, status, email

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
- POST /admin/users - create new user (send setup email)
- GET /admin/users - list all users
- GET /admin/users/:id - get user details
- PUT /admin/users/:id/role - update user role (check permissions)
- PUT /admin/users/:id/status - activate/deactivate user
- POST /admin/users/:id/resend-setup - resend password setup email
- POST /admin/users/:id/reset-password - trigger password reset for user

### Middleware
- requireAuth() - verify JWT, attach user to request
- requireRole(['admin']) - admin-only routes
- requireRole(['admin', 'board']) - admin or board routes
- requireRole(['admin', 'board', 'arb']) - elevated access
- rateLimitLogin() - limit login attempts
- rateLimitPasswordReset() - limit reset requests

### Database Schema
User {
  id: string (uuid)
  email: string (unique, indexed)
  password_hash: string
  role: 'member' | 'arb' | 'board' | 'admin'
  status: 'pending_setup' | 'active' | 'inactive'
  mfa_enabled: boolean
  mfa_secret: string (encrypted, nullable)
  created_at: timestamp
  updated_at: timestamp
  created_by: string (user_id, nullable)
  last_login: timestamp (nullable)
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

### Frontend Components
- Login form (email, password, remember me, MFA if enabled)
- Password setup form (first-time users)
- Forgot password form
- Reset password form
- Update password form (in user settings)
- MFA setup wizard (QR code, verification)
- User management table (admin/board)
- Create user modal (admin/board)
- Role assignment form with permission checks

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

### Phase 6: Testing & Polish
1. Test all auth flows end-to-end
2. Test role permission boundaries
3. Test rate limiting effectiveness
4. Test email delivery
5. UX testing with non-technical users
6. Mobile responsiveness testing
7. Security audit

## Security Checklist
- [ ] Passwords hashed with bcrypt/argon2 (cost factor 10+)
- [ ] MFA secrets encrypted at rest in KV
- [ ] All tokens cryptographically random (32+ bytes)
- [ ] Rate limiting on login (5 per 15 min)
- [ ] Rate limiting on password reset (3 per hour)
- [ ] Password setup tokens expire (24-48 hours)
- [ ] Password reset tokens expire (1-2 hours)
- [ ] JWT tokens have proper expiration (15 min)
- [ ] Admin routes restricted to admin role only
- [ ] Board routes restricted to admin+board only
- [ ] Role assignment permission checks enforced
- [ ] CSRF protection enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize outputs)
- [ ] Audit logging for sensitive actions
- [ ] Email templates don't expose sensitive info
- [ ] Token URLs use HTTPS only
- [ ] Secure session cookie settings (httpOnly, secure, sameSite)

## UX Checklist (Non-Technical Users)
- [ ] Forms have clear, simple labels
- [ ] Error messages are friendly and actionable
- [ ] Success states have clear visual feedback
- [ ] Password visibility toggle on all password fields
- [ ] Password strength indicator (visual)
- [ ] Mobile-responsive design
- [ ] Large, tappable buttons on mobile
- [ ] Email templates are clear and professional
- [ ] Setup/reset flows work in 3 steps or less
- [ ] Help text available where needed
- [ ] Support contact info easily accessible
- [ ] Tested with real non-technical users

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
