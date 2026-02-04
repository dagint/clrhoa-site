# Security Guide

Complete security documentation for the Crooked Lake Reserve HOA website.

## Overview

This site implements multiple layers of security to protect both the site and its users. Current security posture: **A (92/100)**.

## Quick Links

- [Security Assessment](#security-assessment) - Overall security evaluation
- [Security Headers](#security-headers) - HTTP security headers configuration
- [Dependency Security](#dependency-security) - Managing dependencies and vulnerabilities
- [Security Monitoring](#security-monitoring) - Monitoring and incident response
- [Subresource Integrity](#subresource-integrity) - SRI for external scripts

## Security Assessment

**Current Status**: A (92/100) - Excellent

### Strengths

- ✅ Static site architecture (minimal attack surface)
- ✅ Comprehensive security headers (CSP, HSTS, etc.)
- ✅ Form security (StaticForms: honeypot + optional reCAPTCHA)
- ✅ Privacy protection (no exposed PII)
- ✅ Automated dependency updates (Dependabot)
- ✅ External script integrity (SRI)

See `SECURITY_ASSESSMENT.md` for detailed analysis and `SECURITY_SUMMARY.md` for executive summary.

## Security Headers

All security headers are implemented via `src/middleware.ts`:

- Content Security Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy

**Configuration**: See `SECURITY_HEADERS.md` for detailed header configuration and Cloudflare setup.

## Dependency Security

### Automated Updates

Dependabot is configured (`.github/dependabot.yml`) to:
- Scan dependencies weekly
- Create PRs for security updates
- Group updates to reduce noise

### Manual Checks

```bash
npm run audit        # Check for vulnerabilities
npm run audit:fix    # Fix automatically fixable issues
```

**Procedures**: See `DEPENDENCY_SECURITY.md` for complete dependency management guide.

## Security Monitoring

### Automated Monitoring

- Dependabot security alerts
- GitHub security advisories
- Dependency vulnerability scanning

### Manual Monitoring

- Weekly: `npm audit`, review Dependabot PRs
- Monthly: Test security headers, SSL/TLS, review dependencies
- Quarterly: Comprehensive security audit

**Checklists**: See `SECURITY_MONITORING.md` for complete monitoring procedures.

## Subresource Integrity

External scripts are protected with SRI hashes where applicable:
- reCAPTCHA (when enabled; see contact form)
- Plausible Analytics

**Guide**: See `SRI.md` for hash generation and update procedures.

## Privacy & PII Protection

All Personally Identifiable Information (PII) is stored in environment variables:
- Email addresses
- Mailing addresses
- Physical addresses
- Meeting locations

**Setup**: See `ENVIRONMENT_VARIABLES.md` and `PII_MIGRATION.md` for details.

## Incident Response

### Security Incident Process

1. **Identify** - Detect and assess the issue
2. **Contain** - Prevent further damage
3. **Remediate** - Fix the vulnerability
4. **Communicate** - Notify stakeholders if needed
5. **Monitor** - Verify fix and prevent recurrence

See `SECURITY_MONITORING.md` for detailed procedures.

## Compliance

- ✅ **GDPR**: Compliant (privacy-friendly analytics, no cookies without consent)
- ✅ **CCPA**: Compliant (no personal data collection)
- ✅ **PECR**: Compliant (UK/EU privacy regulations)

## Testing Security

### Online Tools

- [Security Headers](https://securityheaders.com) - Test HTTP headers
- [Mozilla Observatory](https://observatory.mozilla.org) - Comprehensive analysis
- [SSL Labs](https://www.ssllabs.com/ssltest/) - SSL/TLS testing

### Manual Testing

```bash
# Test headers
curl -I https://clrhoa.com

# Check dependencies
npm run audit

# Test build
npm run build
```

## Best Practices

1. ✅ Keep dependencies updated
2. ✅ Review Dependabot PRs regularly
3. ✅ Run security audits monthly
4. ✅ Monitor for vulnerabilities
5. ✅ Update security headers as needed
6. ✅ Test security improvements

## Related Documentation

- `SECURITY_ASSESSMENT.md` - Detailed security analysis
- `SECURITY_SUMMARY.md` - Executive summary
- `SECURITY_HEADERS.md` - Header configuration guide
- `DEPENDENCY_SECURITY.md` - Dependency management
- `SECURITY_MONITORING.md` - Monitoring procedures
- `SRI.md` - Subresource Integrity guide
- `ENVIRONMENT_VARIABLES.md` - PII protection

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Cloudflare Security](https://developers.cloudflare.com/security/)
