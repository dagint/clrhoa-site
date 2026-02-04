# Security Headers Configuration Guide

This site implements security headers via Astro middleware and Cloudflare configuration.

## Headers Implemented

### Via Astro Middleware (`src/middleware.ts`)

1. **X-Content-Type-Options: nosniff**
   - Prevents MIME type sniffing
   - Protects against content-type confusion attacks

2. **X-Frame-Options: DENY**
   - Prevents clickjacking attacks
   - Blocks site from being embedded in iframes

3. **X-XSS-Protection: 1; mode=block**
   - Legacy XSS protection (modern browsers use CSP)
   - Still useful for older browsers

4. **Referrer-Policy: strict-origin-when-cross-origin**
   - Controls referrer information sent
   - Balances privacy and functionality

5. **Permissions-Policy**
   - Restricts browser features (geolocation, camera, microphone)
   - Prevents unauthorized access to device features

6. **Strict-Transport-Security (HSTS)**
   - Forces HTTPS connections
   - Prevents protocol downgrade attacks
   - Includes subdomains and preload support

7. **Content-Security-Policy (CSP)**
   - Restricts resource loading
   - Prevents XSS attacks
   - Controls which scripts/styles can load

## Cloudflare Configuration (Recommended)

For better performance and caching, configure headers at Cloudflare level:

### Cloudflare Pages Headers

1. Go to Cloudflare Dashboard → Pages → your project
2. Navigate to **Settings** → **Headers**
3. Add the following headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Content Security Policy (CSP)

For CSP, use the following policy (adjust as needed):

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://www.google.com https://www.gstatic.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
img-src 'self' data: https: blob:;
connect-src 'self' https://api.staticforms.dev https://challenges.cloudflare.com https://cloudflareinsights.com https://www.google.com;
frame-src 'self' https://www.google.com https://challenges.cloudflare.com;
object-src 'none';
base-uri 'self';
form-action 'self' https://api.staticforms.dev;
frame-ancestors 'none';
upgrade-insecure-requests;
```

## Testing Security Headers

### Online Tools

1. **Security Headers Scanner**
   - https://securityheaders.com
   - Enter your domain to test headers

2. **Mozilla Observatory**
   - https://observatory.mozilla.org
   - Comprehensive security analysis

3. **SSL Labs**
   - https://www.ssllabs.com/ssltest/
   - Test SSL/TLS configuration

### Manual Testing

```bash
# Test headers with curl
curl -I https://clrhoa.com

# Test specific header
curl -I https://clrhoa.com | grep -i "content-security-policy"
```

## CSP Violations

If CSP blocks legitimate resources:

1. Check browser console for violation reports
2. Adjust CSP policy in `src/middleware.ts`
3. Test thoroughly before deploying
4. Consider using CSP reporting endpoint (optional)

## Troubleshooting

### Headers Not Appearing

- Verify middleware is in `src/middleware.ts`
- Check Cloudflare cache (may need to purge)
- Ensure headers aren't being stripped by Cloudflare
- Check browser DevTools → Network → Headers

### CSP Blocking Resources

- Check browser console for CSP violations
- Add necessary sources to CSP policy
- Use `'unsafe-inline'` sparingly (security risk)
- Consider nonces or hashes for inline scripts/styles

## Additional Security Measures

### Cloudflare Settings

1. **SSL/TLS Mode**: Full (strict)
2. **Always Use HTTPS**: Enabled
3. **Automatic HTTPS Rewrites**: Enabled
4. **Minimum TLS Version**: 1.2
5. **Opportunistic Encryption**: Enabled

### Rate Limiting

Configure rate limiting in Cloudflare:
- Dashboard → Security → WAF → Rate Limiting Rules
- Protect form endpoints from abuse

## References

- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [OWASP Secure Headers](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
