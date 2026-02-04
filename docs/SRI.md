# Subresource Integrity (SRI) Guide

Subresource Integrity (SRI) is a security feature that allows browsers to verify that resources they fetch (for example, from a CDN) are delivered without unexpected manipulation.

## What is SRI?

SRI works by allowing you to provide a cryptographic hash that a fetched resource must match. If the resource doesn't match the hash, the browser will refuse to execute it.

## Why Use SRI?

- ✅ **Prevents CDN compromise attacks** - Even if a CDN is compromised, your site won't load malicious scripts
- ✅ **Ensures script integrity** - Verifies scripts haven't been tampered with
- ✅ **Security best practice** - Recommended by OWASP and security experts

## Current Implementation

### External Scripts with SRI

1. **Google reCAPTCHA** (optional, `src/pages/contact.astro`)
   - When reCAPTCHA is enabled, scripts load from `https://www.google.com` / `https://www.gstatic.com`
   - **Note**: reCAPTCHA scripts update frequently. SRI may need regular updates if you add integrity hashes.

2. **Cloudflare Web Analytics** (`src/components/Analytics.astro`, when using manual token)
   - Script: `https://static.cloudflareinsights.com/beacon.min.js`
   - **Note**: SRI can be added if desired; the beacon script is maintained by Cloudflare.

## Generating SRI Hashes

### Quick Method: Online Tools (Recommended)

1. Visit: https://www.srihash.org/
2. Enter the script URL:
   - For reCAPTCHA (if used): `https://www.google.com/recaptcha/api.js` or the version you load
   - For Cloudflare beacon: `https://static.cloudflareinsights.com/beacon.min.js`
3. Click "Generate"
4. Copy the hash (format: `sha384-...`)
5. Update the `integrity` attribute in the respective file

### Using the Provided Script

```bash
# Generate hash for Cloudflare beacon (if adding SRI)
node scripts/generate-sri.js https://static.cloudflareinsights.com/beacon.min.js

# Or use npm script
npm run sri https://static.cloudflareinsights.com/beacon.min.js
```

**Note**: If the script encounters redirects or fails, use the online tool method above.

### Manual Method (PowerShell)

```powershell
$content = (Invoke-WebRequest -Uri "https://static.cloudflareinsights.com/beacon.min.js" -UseBasicParsing).Content
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$hash = [System.Security.Cryptography.SHA384]::Create().ComputeHash($bytes)
$base64 = [Convert]::ToBase64String($hash)
Write-Host "sha384-$base64"
```

## Updating SRI Hashes

### When to Update

SRI hashes need to be updated when:
- External scripts are updated by their providers
- You see console errors about integrity checks failing
- You intentionally update to a new script version

### Update Process

1. **Generate new hash** using one of the methods above
2. **Update the integrity attribute** in the file:
   ```astro
   <script 
     src="https://example.com/script.js"
     integrity="sha384-NEW_HASH_HERE"
     crossorigin="anonymous"
   ></script>
   ```
3. **Test thoroughly**:
   - Verify script loads correctly
   - Check browser console for errors
   - Test functionality
4. **Deploy**:
   - Commit the change
   - Deploy to production
   - Monitor for issues

## Files to Update

| Script | File | Line | Status |
|--------|------|------|--------|
| reCAPTCHA (optional) | `src/pages/contact.astro` | — | Optional; add SRI if used |
| Cloudflare Web Analytics | `src/components/Analytics.astro` | — | Optional; add SRI if desired |

## SRI Limitations

### Dynamic Scripts

Some scripts update frequently (e.g. reCAPTCHA), which can cause issues:

- **Problem**: Hash changes when script updates
- **Solution**: 
  - Monitor for integrity failures
  - Update hash when needed
  - Consider using versioned script URLs if available

### Fallback Behavior

If SRI check fails:
- Browser will **not** load the script
- Console will show integrity error
- Site functionality may break

**Important**: Always test after updating SRI hashes!

## Best Practices

### 1. Use SRI for All External Scripts

```html
<script 
  src="https://example.com/script.js"
  integrity="sha384-..."
  crossorigin="anonymous"
></script>
```

### 2. Use crossorigin="anonymous"

Required for SRI to work with cross-origin resources.

### 3. Monitor for Failures

- Check browser console regularly
- Set up monitoring for integrity failures
- Have a process to update hashes quickly

### 4. Version Control

- Commit SRI hashes to git
- Document when hashes are updated
- Keep a log of hash changes

## Troubleshooting

### Script Not Loading

**Symptom**: Script doesn't execute, console shows integrity error

**Solution**:
1. Check if script URL changed
2. Generate new SRI hash
3. Update integrity attribute
4. Test and deploy

### Hash Mismatch

**Symptom**: Browser console shows "Failed to find a valid digest"

**Solution**:
1. Verify script URL is correct
2. Regenerate hash for current script version
3. Update integrity attribute
4. Clear browser cache and test

### CORS Errors

**Symptom**: CORS errors in console

**Solution**:
- Ensure `crossorigin="anonymous"` is set
- Verify CDN supports CORS
- Check if script provider requires authentication

## Resources

- [MDN: Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [W3C SRI Specification](https://www.w3.org/TR/SRI/)
- [OWASP: Subresource Integrity](https://cheatsheetseries.owasp.org/cheatsheets/Subresource_Integrity_Cheat_Sheet.html)
- [SRI Hash Generator](https://www.srihash.org/)
