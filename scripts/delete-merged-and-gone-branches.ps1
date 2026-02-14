# Delete local branches that are merged or whose remote was deleted (gone).
# Keeps: main, and branches that still exist on origin.
$safeToDelete = @(
  'security/critical-fixes',
  'chore/db-indexes-performance',
  'docs/future-implementation-specs', 'docs/phase2-organize-subdirectories', 'docs/phase3-consolidate-duplicates',
  'feat/add-drone-hero-images', 'feat/admin-password-reset-trigger', 'feat/admin-permission-management', 'feat/admin-user-management',
  'feat/auth-middleware-integration', 'feat/auth-schema-phase1', 'feat/change-password-ui', 'feat/dynamic-role-based-navigation',
  'feat/dynamic-route-guards', 'feat/e2e-rbac-testing', 'feat/e2e-testing-setup', 'feat/email-template-improvements',
  'feat/login-logout-endpoints', 'feat/low-priority-security-improvements', 'feat/mfa-settings-ui', 'feat/mfa-totp',
  'feat/password-reset-flow', 'feat/password-setup-flow', 'feat/permissions-api-helpers', 'feat/rate-limiting-security',
  'feat/role-change-notifications', 'feat/security-audit', 'feat/security-improvements-medium-priority', 'feat/ux-polish-password-improvements',
  'feature/admin-test-email-troubleshooting', 'feature/audit-logs-redact-pii', 'feature/board-public-no-redirect',
  'feature/github-secrets-to-cloudflare', 'feature/pagination-auth-logging-improvements', 'feature/vendor-list-csv-upload', 'feature/vendor-list-spreadsheet-edits',
  'fix-deploy', 'fix-deploy-with-vars', 'fix-sec-sync', 'fix-sync-deploy',
  'fix/astro-build-and-lint-issues', 'fix/auth-theming-and-password-reset', 'fix/cloudflare-secrets-sync', 'fix/contact-form-resend',
  'fix/e2e-ci-database-init', 'fix/lint-errors', 'fix/maintenance-submit-500', 'fix/public-env-vars', 'fix/secrets-sync-wrangler', 'fix/sync-pages-env-vars',
  'hotfix/login-page-404', 'hotfix/password-verification-argument-order',
  'pre-commit-lint', 'rbac-and-standards', 'rbac-landing-zone', 'rbac-routing', 'reduce-form-dup',
  'refactor/consolidate-database-schemas', 'rolespec-nav', 'test',
  'portal2'   # local-only; remove from list if you want to keep it
)

$currentBranch = git branch --show-current
foreach ($b in $safeToDelete) {
  if ($b -eq $currentBranch) { Write-Host "Skipping current branch: $b"; continue }
  $exists = git rev-parse --verify $b 2>$null
  if ($LASTEXITCODE -eq 0) {
    git branch -d $b
    if ($LASTEXITCODE -ne 0) { git branch -D $b }
  }
}
Write-Host "Done."
