# Public Documents

All public documents (Bylaws, Covenants, Proxy Form, ARB Request Form) are now stored in **R2** and served via `/api/public-doc-file`.

## For Board Members

**Manage documents at:** `/board/public-documents`

- Upload/replace documents through the web interface
- Files are stored in R2 bucket: `clrhoa-files/public-docs/`
- Changes are immediately visible on the `/documents` page
- No deployment required to update documents

## For Developers

**Storage:**
- Location: R2 bucket `clrhoa-files/public-docs/`
- Metadata: D1 table `public_documents`
- Serve endpoint: `/api/public-doc-file?slug=<slug>`

**Documents:**
- `bylaws` → `public-docs/bylaws.pdf`
- `covenants` → `public-docs/covenants.pdf`
- `proxy-form` → `public-docs/proxy-form.docx`
- `arb-request-form` → `public-docs/arb-request-form.docx`

**Content collections:**
- Metadata files remain in `src/content/documents/*.md`
- These define title, description, category, etc.
- The `/documents` page checks for R2 overrides first

## Benefits

✅ Update documents without code deployment
✅ Reduced repository size (~3.9MB saved)
✅ Centralized storage in R2
✅ Board self-service document management
✅ Consistent with protected portal documents

## Migration

Migrated on 2026-02-12:
- Uploaded 4 documents to R2 (remote)
- Updated D1 database with file keys
- Removed static files from repository
- Maintained content collection metadata
