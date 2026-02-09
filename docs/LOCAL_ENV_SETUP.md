# Local Environment Setup

This project uses **split environment files** for better organization:

- **`.vars.local`** - Build-time PUBLIC_* variables (addresses, contact info, dues, etc.)
- **`.secrets.local`** - Runtime secrets (SESSION_SECRET, API keys, tokens, etc.)
- **`.env.local`** - Auto-generated from the above (do not edit directly)

## Workflow

### 1. Edit Source Files

Edit the authoritative source files:

- **`.vars.local`** - For PUBLIC_* variables (build-time)
- **`.secrets.local`** - For runtime secrets

### 2. Merge to .env.local

The merge happens automatically before `dev`, `start`, or `build`:

```bash
npm run dev    # Automatically merges .vars.local + .secrets.local → .env.local
npm run build  # Same - auto-merge before build
```

Or manually:

```bash
npm run env:merge
```

### 3. How It Works

The `merge-env-files.js` script:
- Reads `.vars.local` (PUBLIC_* variables)
- Reads `.secrets.local` (runtime secrets)
- Merges them into `.env.local`
- Secrets override vars if there's a conflict (secrets take precedence)

## File Priority

1. **`.vars.local`** + **`.secrets.local`** (authoritative - edit these)
2. **`.env.local`** (auto-generated - don't edit directly)

## Example

**`.vars.local`:**
```
PUBLIC_MAILING_ADDRESS_NAME=Crooked Lake Reserve HOA
PUBLIC_PHYSICAL_ADDRESS_STREET=2 Lakes Ln
```

**`.secrets.local`:**
```
SESSION_SECRET=your-secret-key
NOTIFY_NOREPLY_EMAIL=noreply@example.com
```

**Result `.env.local` (auto-generated):**
```
# Build-time variables (PUBLIC_*)
PUBLIC_MAILING_ADDRESS_NAME=Crooked Lake Reserve HOA
PUBLIC_PHYSICAL_ADDRESS_STREET=2 Lakes Ln

# Runtime secrets (Workers)
NOTIFY_NOREPLY_EMAIL=noreply@example.com
SESSION_SECRET=your-secret-key
```

## Benefits

- **Separation of concerns**: Public vars vs secrets
- **Git-friendly**: Both source files are gitignored
- **Easy sync**: Export to GitHub with `npm run vars:update` and `npm run secrets:update`
- **Auto-merge**: No manual file management needed

## Troubleshooting

**`.env.local` is out of sync?**
```bash
npm run env:merge
```

**Want to see what will be merged?**
```bash
# Check .vars.local
cat .vars.local

# Check .secrets.local  
cat .secrets.local

# Merge and see result
npm run env:merge
cat .env.local
```

**Note:** If `.vars.local` or `.secrets.local` don't exist, the merge will still work (just uses what's available).
