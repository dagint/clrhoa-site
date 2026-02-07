# Dependency Security Management

This guide covers dependency security practices for the Crooked Lake Reserve HOA website.

## Automated Dependency Updates

### Dependabot

Dependabot is configured to automatically check for dependency updates and create pull requests.

**Configuration:** `.github/dependabot.yml`

**Schedule:**
- **npm packages**: Weekly (Mondays at 9:00 AM)
- **GitHub Actions**: Monthly

**Features:**
- Automatic security updates
- Version update PRs
- Grouped updates (production vs development)
- Labeled PRs for easy identification

### Reviewing Dependabot PRs

1. **Check the PR description** - Review what changed
2. **Review changelog** - Check for breaking changes
3. **Test locally** - Pull the branch and test
4. **Check security** - Verify no security issues introduced
5. **Merge** - If everything looks good

### Handling Breaking Changes

If a major version update introduces breaking changes:

1. Review the migration guide
2. Test thoroughly
3. Update code if needed
4. Consider delaying if not critical

## CI

The **CI workflow** (`.github/workflows/ci.yml`) runs on every push and pull request to `main`:

- **Tests** — `npm test -- --run`
- **Audit** — `npm audit --audit-level=high` (fails the build if high or critical vulnerabilities exist)
- **Build** — `npm run build`

Fix or suppress high/critical issues before merging so the main branch stays clear.

## Manual Dependency Checks

### Check for Vulnerabilities

```bash
# Check for known vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# Fix issues including breaking changes (use with caution)
npm audit fix --force
```

### Update Dependencies Manually

```bash
# Check for outdated packages
npm outdated

# Update a specific package
npm update package-name

# Update to latest (may include breaking changes)
npm update package-name@latest
```

### Review Updates

```bash
# See what would change
npm outdated

# Review package changelogs
# Visit package pages on npmjs.com
```

## Security Audit Process

### Weekly Checks

1. Run `npm audit`
2. Review any vulnerabilities
3. Apply fixes if available
4. Document any unfixable issues

### Monthly Reviews

1. Review Dependabot PRs
2. Update dependencies as needed
3. Test thoroughly after updates
4. Deploy updates

### Quarterly Reviews

1. Review all dependencies
2. Check for deprecated packages
3. Consider alternatives for outdated packages
4. Update major versions if stable

## Vulnerability Severity Levels

### Critical
- **Action**: Fix immediately
- **Timeline**: Within 24 hours
- **Process**: Create hotfix PR, test, deploy

### High
- **Action**: Fix as soon as possible
- **Timeline**: Within 1 week
- **Process**: Create PR, test, deploy in next release

### Moderate
- **Action**: Fix in next release
- **Timeline**: Within 1 month
- **Process**: Include in regular update cycle

### Low
- **Action**: Fix when convenient
- **Timeline**: Next major update
- **Process**: Include in planned updates

## Best Practices

### 1. Keep Dependencies Updated

- ✅ Review Dependabot PRs regularly
- ✅ Update dependencies monthly
- ✅ Test updates before deploying
- ✅ Keep changelogs for reference

### 2. Minimize Dependencies

- ✅ Only add necessary packages
- ✅ Review alternatives before adding
- ✅ Remove unused dependencies
- ✅ Prefer built-in solutions when possible

### 3. Use Trusted Sources

- ✅ Use official npm packages
- ✅ Check package maintainers
- ✅ Review package popularity
- ✅ Check for recent updates

### 4. Security First

- ✅ Run `npm audit` regularly
- ✅ Fix vulnerabilities promptly
- ✅ Review security advisories
- ✅ Monitor for new vulnerabilities

## Package Lock File

The `package-lock.json` file ensures consistent installs:

- ✅ **Commit it** - Ensures consistent versions
- ✅ **Don't ignore it** - Required for security
- ✅ **Update regularly** - Keep in sync with package.json

## Handling Vulnerabilities

### Step 1: Identify

```bash
npm audit
```

### Step 2: Assess

- Check severity level
- Review vulnerability details
- Check if fix is available

### Step 3: Fix

```bash
# Try automatic fix first
npm audit fix

# If that doesn't work, update manually
npm update vulnerable-package@version
```

### Step 4: Verify

```bash
# Verify fix
npm audit

# Test the application
npm run build
npm run preview
```

### Step 5: Document

- Document the vulnerability
- Note the fix applied
- Update security logs

## Emergency Updates

For critical security vulnerabilities:

1. **Immediate Action**
   ```bash
   npm audit fix --force
   ```

2. **Test Thoroughly**
   ```bash
   npm run build
   npm run preview
   ```

3. **Deploy Immediately**
   - Create hotfix branch
   - Test in staging (if available)
   - Deploy to production

4. **Document**
   - Document the vulnerability
   - Note the emergency fix
   - Update security procedures if needed

## Resources

- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [npm Audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Snyk Vulnerability Database](https://security.snyk.io/)

## Checklist

### Weekly
- [ ] Run `npm audit`
- [ ] Review Dependabot PRs
- [ ] Check for critical vulnerabilities

### Monthly
- [ ] Review all Dependabot PRs
- [ ] Update dependencies
- [ ] Test updates
- [ ] Deploy updates

### Quarterly
- [ ] Review all dependencies
- [ ] Check for deprecated packages
- [ ] Update major versions
- [ ] Review security posture
