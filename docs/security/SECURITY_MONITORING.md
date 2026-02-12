# Security Monitoring Guide

This guide covers security monitoring practices for the Crooked Lake Reserve HOA website.

## Monitoring Overview

Security monitoring helps detect and respond to security issues quickly. For a static site, monitoring focuses on:

1. **Dependency vulnerabilities**
2. **Security header compliance**
3. **Form submission patterns**
4. **SSL/TLS certificate status**
5. **External script integrity**

## Automated Monitoring

### 1. Dependabot Security Alerts

**Status**: ✅ Configured (`.github/dependabot.yml`)

**What it monitors**:
- Dependency vulnerabilities
- Outdated packages
- Security advisories

**How it works**:
- Automatically scans dependencies
- Creates PRs for security updates
- Alerts on critical vulnerabilities

**Action required**:
- Review Dependabot PRs regularly
- Merge security updates promptly
- Test updates before deploying

### 2. GitHub Security Advisories

**Status**: ✅ Automatic (GitHub feature)

**What it monitors**:
- Known vulnerabilities in dependencies
- Security advisories from npm

**How to access**:
- GitHub → Repository → Security → Dependabot alerts
- View all security alerts
- Review recommended fixes

**Action required**:
- Check alerts weekly
- Fix critical issues immediately
- Document fixes

## Manual Monitoring

### 1. Dependency Security Checks

**Frequency**: Weekly

**Process**:
```bash
# Check for vulnerabilities
npm audit

# Review output
# Fix issues if found
npm audit fix

# Document findings
```

**What to look for**:
- Critical vulnerabilities (fix immediately)
- High vulnerabilities (fix within week)
- Moderate vulnerabilities (fix in next update)
- Low vulnerabilities (fix when convenient)

### 2. Security Headers Monitoring

**Frequency**: Monthly

**Tools**:
- [Security Headers](https://securityheaders.com) - Enter `clrhoa.com`
- [Mozilla Observatory](https://observatory.mozilla.org) - Comprehensive analysis

**What to check**:
- ✅ Content Security Policy (CSP)
- ✅ Strict-Transport-Security (HSTS)
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Referrer-Policy

**Action required**:
- Aim for A+ rating
- Fix any missing headers
- Update CSP if needed

### 3. SSL/TLS Monitoring

**Frequency**: Monthly

**Tools**:
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Enter `clrhoa.com`
- Cloudflare Dashboard → SSL/TLS

**What to check**:
- ✅ SSL certificate validity
- ✅ TLS version (1.2+)
- ✅ Certificate chain
- ✅ Cipher suites

**Action required**:
- Aim for A+ rating
- Monitor certificate expiration
- Update TLS settings if needed

### 4. Form Submission Monitoring

**Frequency**: Weekly

**What to monitor**:
- Submission volume
- Spam patterns
- Failed submissions
- reCAPTCHA success rate (if enabled)

**Where to check**:
- StaticForms Dashboard → Submissions
- Google reCAPTCHA admin (if enabled)

**What to look for**:
- Unusual spikes in submissions
- High spam rate
- Failed integrity checks
- Bot activity patterns

**Action required**:
- Review suspicious patterns
- Adjust reCAPTCHA or StaticForms settings if needed
- Block repeat offenders if possible

### 5. External Script Integrity

**Frequency**: Monthly

**What to monitor**:
- SRI hash failures
- Script loading errors
- CDN availability

**How to check**:
- Browser console for errors
- Site functionality tests
- Generate new SRI hashes if scripts updated

**Action required**:
- Update SRI hashes when scripts change
- Monitor for integrity failures
- Document hash updates

## Monitoring Checklist

### Daily
- [ ] Check GitHub security alerts (if any)
- [ ] Monitor form submissions (if unusual activity)

### Weekly
- [ ] Run `npm audit`
- [ ] Review Dependabot PRs
- [ ] Check form submission patterns
- [ ] Review browser console for errors

### Monthly
- [ ] Test security headers (securityheaders.com)
- [ ] Test SSL/TLS (ssllabs.com)
- [ ] Review dependency updates
- [ ] Check SRI hash validity
- [ ] Review security logs

### Quarterly
- [ ] Comprehensive security audit
- [ ] Review all dependencies
- [ ] Update security documentation
- [ ] Review incident response procedures

## Alert Thresholds

### Critical (Immediate Action)
- Dependency vulnerability with exploit available
- SSL certificate expired
- Site compromised or defaced
- Data breach detected

**Response**: Fix within 24 hours

### High (Urgent)
- High-severity dependency vulnerability
- Security headers missing
- High spam rate on forms
- SRI integrity failures

**Response**: Fix within 1 week

### Medium (Important)
- Moderate dependency vulnerability
- SSL certificate expiring soon (< 30 days)
- Unusual form submission patterns
- Outdated dependencies

**Response**: Fix in next update cycle

### Low (Monitor)
- Low-severity vulnerabilities
- Minor security header improvements
- Dependency updates available
- Performance optimizations

**Response**: Fix when convenient

## Incident Response

### Security Incident Process

1. **Identify**
   - Detect the security issue
   - Assess severity
   - Document details

2. **Contain**
   - Isolate affected systems
   - Prevent further damage
   - Preserve evidence

3. **Remediate**
   - Fix the vulnerability
   - Update affected systems
   - Test thoroughly

4. **Communicate**
   - Notify stakeholders if needed
   - Update security documentation
   - Document lessons learned

5. **Monitor**
   - Verify fix is working
   - Monitor for recurrence
   - Update procedures if needed

### Portal/API-specific actions

For incidents involving the member portal or board (e.g. suspected session compromise or abuse):

- **Revoke all sessions**: Rotate `SESSION_SECRET` in Cloudflare (wrangler secret put SESSION_SECRET). All existing session cookies become invalid; users must log in again.
- **Lock an account**: Remove or change the user’s KV entry in `CLOURHOA_USERS` (or use your process for disabling access) so they cannot log in until restored.
- **Restore data**: Use D1 backups and R2 as needed; see `BACKUP_AND_RECOVERY.md` and `BACKUP_SETUP.md`.
- **Review access**: Check `directory_logs` and ARB audit logs (board audit views) for unusual activity by the affected identity or IP.

## Monitoring Tools

### Free Tools

1. **Security Headers**
   - URL: https://securityheaders.com
   - Tests: HTTP security headers
   - Frequency: Monthly

2. **SSL Labs**
   - URL: https://www.ssllabs.com/ssltest/
   - Tests: SSL/TLS configuration
   - Frequency: Monthly

3. **Mozilla Observatory**
   - URL: https://observatory.mozilla.org
   - Tests: Comprehensive security analysis
   - Frequency: Monthly

4. **GitHub Security**
   - URL: Repository → Security tab
   - Tests: Dependency vulnerabilities
   - Frequency: Continuous

### Cloudflare Tools

1. **Cloudflare Analytics**
   - Monitor: Traffic patterns, threats
   - Access: Cloudflare Dashboard

2. **StaticForms / reCAPTCHA**
   - Monitor: Form submissions, bot detection (if reCAPTCHA enabled)
   - Access: StaticForms dashboard; Google reCAPTCHA admin if used

3. **Cloudflare WAF**
   - Monitor: Web application firewall logs
   - Access: Cloudflare Dashboard → Security

## Documentation

### Security Log

Maintain a security log documenting:
- Security checks performed
- Vulnerabilities found and fixed
- Updates applied
- Incidents and responses

### Update Log

Track dependency updates:
- Date of update
- Packages updated
- Version changes
- Testing performed
- Deployment date

## Best Practices

1. **Regular Monitoring**
   - Don't wait for alerts
   - Proactive checking is better
   - Schedule regular reviews

2. **Document Everything**
   - Keep security logs
   - Document fixes
   - Track patterns

3. **Test Before Deploy**
   - Always test security updates
   - Verify fixes work
   - Don't skip testing

4. **Stay Informed**
   - Follow security news
   - Subscribe to advisories
   - Join security communities

5. **Automate When Possible**
   - Use Dependabot
   - Set up alerts
   - Automate checks

## Resources

- [OWASP Security Monitoring](https://owasp.org/www-community/Security_Monitoring)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Cloudflare Security Documentation](https://developers.cloudflare.com/security/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
