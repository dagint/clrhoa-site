# Security & Best Practice Recommendations for ARB Portal

This document outlines additional security posture improvements and best practices appropriate for an HOA site handling sensitive personal and property data.

## Current Security Posture ✅

### Already Implemented
- ✅ CSRF protection (tokens + origin verification)
- ✅ Server-side file type validation (MIME type checking)
- ✅ Session timeout (30-minute inactivity)
- ✅ Security headers (CSP, X-Frame-Options, HSTS, etc.)
- ✅ Rate limiting (5 submissions per day)
- ✅ Audit logging (arb_audit_log table)
- ✅ Input validation (client + server-side)
- ✅ Secure session management (HttpOnly, Secure cookies)
- ✅ Role-based access control
- ✅ Transaction safety for file operations

---

## High Priority Recommendations 🔴

### 1. **Account Lockout After Failed Login Attempts**
**Risk**: Brute force attacks on login endpoint  
**Impact**: Unauthorized access to member accounts  
**Implementation**:
- Track failed login attempts per email/IP in KV store
- Lock account after 5 failed attempts for 15 minutes
- Log failed attempts to audit log
- Clear lockout on successful login

**Files to modify**:
- `src/pages/api/login.astro` - Add attempt tracking
- `src/lib/auth.ts` - Add lockout check function

---

### 2. **PII Masking in Logs**
**Risk**: Sensitive data exposure in error logs  
**Impact**: Privacy violation, compliance issues  
**Implementation**:
- Mask email addresses in logs (e.g., `j***@example.com`)
- Mask phone numbers (e.g., `***-***-1234`)
- Mask property addresses (e.g., `123 *** St`)
- Only log last 4 digits of request IDs

**Files to modify**:
- Create `src/lib/logging.ts` - PII masking utilities
- Update all `console.error/warn` calls to use masked logging

---

### 3. **Structured Error Tracking & Monitoring**
**Risk**: Security incidents go undetected  
**Impact**: Delayed response to attacks, data breaches  
**Implementation**:
- Integrate with error tracking service (Sentry, LogRocket, or Cloudflare Analytics)
- Log security events (failed logins, CSRF failures, rate limit hits)
- Set up alerts for suspicious patterns
- Track API error rates and response times

**Options**:
- **Cloudflare Analytics**: Already available, add custom events
- **Sentry**: Free tier available, excellent error tracking
- **Cloudflare Workers Analytics**: Built-in monitoring

---

### 4. **Data Backup & Recovery Procedures**
**Risk**: Data loss from corruption or accidental deletion  
**Impact**: Loss of ARB request history, legal/audit issues  
**Implementation**:
- **D1 Database**: Set up automated backups (Cloudflare D1 supports scheduled backups)
- **R2 Files**: Enable versioning and lifecycle policies
- **Documentation**: Create recovery runbook
- **Testing**: Test restore procedures quarterly

**Cloudflare D1 Backup**:
```bash
# Manual backup
wrangler d1 export clrhoa_db --output backup-$(date +%Y%m%d).sql

# Automated: Use Cloudflare Workers cron triggers
```

**R2 Lifecycle Policy**:
- Enable versioning for `clrhoa-files` bucket
- Set lifecycle rule: Delete non-current versions after 90 days

---

### 5. **Enhanced Input Sanitization**
**Risk**: XSS attacks via user-generated content  
**Impact**: Session hijacking, data theft  
**Implementation**:
- Sanitize all user input before display (description, notes, applicant name)
- Use DOMPurify or similar for HTML content
- Escape special characters in text fields
- Validate and sanitize file names

**Files to modify**:
- `src/components/ArbDashboardCard.astro` - Sanitize displayed content
- `src/pages/portal/my-requests.astro` - Sanitize user input display

---

## Medium Priority Recommendations 🟡

### 6. **Data Retention & Deletion Policies**
**Risk**: Storing data longer than necessary, compliance issues  
**Impact**: Privacy violations, increased attack surface  
**Implementation**:
- Define retention periods:
  - **Approved/Rejected requests**: 7 years (legal/audit)
  - **Cancelled requests**: 1 year
  - **Audit logs**: 7 years
  - **User sessions**: 7 days (already implemented)
- Create automated cleanup script
- Add "Delete my data" feature for users

**Database Migration**:
```sql
-- Add deleted_at column for soft deletes
ALTER TABLE arb_requests ADD COLUMN deleted_at DATETIME;
CREATE INDEX idx_arb_requests_deleted ON arb_requests(deleted_at);
```

---

### 7. **IP-Based Rate Limiting for API Endpoints**
**Risk**: DDoS attacks, resource exhaustion  
**Impact**: Service unavailability  
**Implementation**:
- Use Cloudflare Rate Limiting (built-in)
- Or implement per-IP rate limiting in KV store
- Different limits for different endpoints:
  - Login: 5 attempts per IP per 15 minutes
  - File upload: 10 requests per IP per hour
  - API endpoints: 100 requests per IP per minute

**Cloudflare Configuration**:
- Enable Rate Limiting rules in dashboard
- Set up rules for `/api/*` endpoints

---

### 8. **Two-Factor Authentication (2FA) for ARB/Admin Roles**
**Risk**: Compromised accounts with elevated privileges  
**Impact**: Unauthorized approvals/rejections, data manipulation  
**Implementation**:
- Use TOTP (Time-based One-Time Password) via authenticator apps
- Store 2FA secrets encrypted in D1
- Require 2FA for ARB, Board, and Admin roles
- Provide backup codes for account recovery

**Libraries**:
- `@otplib/preset-default` - TOTP generation/verification
- `qrcode` - Generate QR codes for setup

---

### 9. **Secure File Deletion**
**Risk**: Deleted files still accessible via direct URLs  
**Impact**: Privacy violations, data exposure  
**Implementation**:
- When deleting files, mark as deleted in DB but keep R2 objects
- Implement secure deletion endpoint that requires authentication
- Use R2 lifecycle policies to auto-delete after retention period
- Log all file deletions to audit log

---

### 10. **Request Size Limits & Timeout Protection**
**Risk**: Large file uploads causing DoS  
**Impact**: Service unavailability  
**Implementation**:
- Set Cloudflare Workers request size limit (already 100MB default)
- Add request timeout (30 seconds for file uploads)
- Validate total request size before processing
- Return clear error messages for size/timeout issues

---

## Low Priority Recommendations 🟢

### 11. **Security.txt File**
**Risk**: No responsible disclosure process  
**Impact**: Security vulnerabilities not reported properly  
**Implementation**:
- Create `public/.well-known/security.txt`
- Include security contact email
- Define disclosure policy

**File**: `public/.well-known/security.txt`
```
Contact: security@clrhoa.com
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://clrhoa.com/.well-known/security.txt
```

---

### 12. **Dependency Security Scanning**
**Risk**: Vulnerable dependencies  
**Impact**: Code execution, data breaches  
**Implementation**:
- Set up Dependabot (GitHub) or similar
- Run `npm audit` in CI/CD pipeline
- Automatically update patch/minor versions
- Review and test major version updates

**GitHub Actions**:
```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm audit --audit-level=moderate
```

---

### 13. **Content Security Policy (CSP) Reporting**
**Risk**: CSP violations go unnoticed  
**Impact**: Potential XSS vulnerabilities  
**Implementation**:
- Add CSP `report-uri` or `report-to` directive
- Set up reporting endpoint or use service (e.g., report-uri.com)
- Monitor CSP violation reports
- Adjust CSP based on legitimate violations

---

### 14. **Data Export Feature for Users**
**Risk**: Users can't access their own data  
**Impact**: GDPR/CCPA compliance issues  
**Implementation**:
- Add "Export my data" button in My Requests
- Generate JSON/CSV export of user's requests
- Include all associated files (as download links)
- Implement within 30 days of request (GDPR requirement)

---

### 15. **Enhanced Session Security**
**Risk**: Session fixation attacks  
**Impact**: Unauthorized access  
**Implementation**:
- Regenerate session ID on login (already done via new token)
- Add session fingerprinting (browser + IP hash)
- Invalidate all sessions on password change (if passwords added)
- Add "Log out all devices" feature

---

### 16. **API Request Signing (Optional)**
**Risk**: Replay attacks  
**Impact**: Unauthorized actions  
**Implementation**:
- Add timestamp + nonce to API requests
- Sign requests with HMAC using session secret
- Reject requests older than 5 minutes
- Only for high-value operations (approve/reject)

**Note**: May be overkill for this use case, but adds defense-in-depth.

---

## Compliance & Legal Considerations

### GDPR/CCPA Compliance
- ✅ Right to access (via export feature - TODO)
- ✅ Right to deletion (via deletion feature - TODO)
- ✅ Data minimization (only collect necessary data)
- ✅ Consent (e-signature checkbox)
- ⚠️ Privacy policy (should be updated to mention ARB portal)

### Data Protection
- ✅ Encryption in transit (HTTPS)
- ✅ Encryption at rest (Cloudflare R2/D1)
- ✅ Access controls (role-based)
- ✅ Audit logging
- ⚠️ Data retention policies (TODO)

---

## Monitoring & Alerting

### Recommended Alerts
1. **Failed login attempts**: > 10 per hour from single IP
2. **CSRF failures**: > 5 per hour
3. **Rate limit hits**: > 20 per hour
4. **API errors**: > 5% error rate
5. **File upload failures**: > 10% failure rate
6. **Database errors**: Any database connection failures
7. **Session timeouts**: Unusual spike in session expirations

### Monitoring Tools
- **Cloudflare Analytics**: Built-in, free
- **Cloudflare Workers Analytics**: Request metrics
- **Sentry**: Error tracking (free tier)
- **Custom dashboard**: Build with Cloudflare GraphQL API

---

## Implementation Priority

### Phase 1 (Immediate - 1-2 weeks)
1. Account lockout after failed attempts
2. PII masking in logs
3. Structured error tracking
4. Data backup procedures

### Phase 2 (Short-term - 1 month)
5. Enhanced input sanitization
6. Data retention policies
7. IP-based rate limiting
8. Secure file deletion

### Phase 3 (Medium-term - 2-3 months)
9. Two-factor authentication
10. Request size limits
11. Security.txt
12. Dependency scanning

### Phase 4 (Long-term - 3-6 months)
13. CSP reporting
14. Data export feature
15. Enhanced session security
16. API request signing (if needed)

---

## Testing & Validation

### Security Testing Checklist
- [ ] Penetration testing (annual)
- [ ] Vulnerability scanning (quarterly)
- [ ] Code security review (before major releases)
- [ ] Dependency audit (monthly)
- [ ] Backup restore testing (quarterly)
- [ ] Incident response drill (annual)

### Compliance Audits
- [ ] GDPR compliance review (annual)
- [ ] Data retention audit (quarterly)
- [ ] Access control review (quarterly)
- [ ] Log retention compliance (quarterly)

---

## Documentation Requirements

### Required Documentation
1. **Security Policy**: Document security practices and procedures
2. **Incident Response Plan**: Steps to follow during security incidents
3. **Backup & Recovery Procedures**: How to restore from backups
4. **Data Retention Policy**: What data is kept and for how long
5. **Privacy Policy**: Updated to include ARB portal data handling

---

## Cost Considerations

### Free/Included Options
- Cloudflare Analytics (free)
- Cloudflare Rate Limiting (free tier: 1,000 rules)
- Dependabot (free for GitHub)
- Cloudflare D1 backups (included)

### Paid Options (if needed)
- Sentry: $26/month (Team plan)
- Enhanced monitoring: Varies
- Security scanning tools: Varies

---

## Notes

- These recommendations are tailored for an HOA site handling sensitive personal and property data
- Prioritize based on your specific threat model and compliance requirements
- Regular security reviews should be conducted quarterly
- Keep dependencies updated and monitor for vulnerabilities
- Document all security decisions and procedures
