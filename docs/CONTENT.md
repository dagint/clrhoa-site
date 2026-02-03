# Content Management Guide

Complete guide for adding and updating content on the HOA website.

## 📰 Adding News Articles

### Step 1: Create a New File

1. Navigate to the `src/content/news/` folder
2. Create a new file with the format: `YYYY-MM-DD-descriptive-name.md`
   - Example: `2026-03-15-spring-cleanup.md`

### Step 2: Add Content

Copy this template and fill in your information:

```markdown
---
title: Your Article Title Here
date: 2026-03-15
summary: A brief one or two sentence summary that appears on the news listing page
tags:
  - meeting
  - event
  - reminder
published: true
---

# Your Article Title Here

Your article content here. You can use Markdown formatting:

- **Bold text**
- *Italic text*
- [Links](https://example.com)
- Lists

## Subheadings

More content...
```

### Required Fields

- `title`: The article title
- `date`: Publication date (YYYY-MM-DD format)
- `summary`: Brief summary (appears on news listing page)
- `published`: Set to `true` to publish, `false` to save as draft

### Optional Fields

- `tags`: Array of tags (e.g., `["meeting", "event"]`)
- `slug`: Custom URL slug (auto-generated from filename if not provided)

### Step 3: Save and Deploy

1. Save the file
2. Commit and push to GitHub
3. Cloudflare Pages will automatically deploy the changes

## 📄 Adding Documents

### Step 1: Upload PDF File

1. Upload your PDF file to `public/documents/files/`
2. Note the filename (e.g., `bylaws-2024.pdf`)

### Step 2: Create Document Entry

1. Navigate to `src/content/documents/`
2. Create a new Markdown file (e.g., `bylaws.md`)

### Step 3: Add Document Metadata

Copy this template:

```markdown
---
title: Document Name
category: Governing Documents
description: Brief description of the document
fileUrl: /documents/files/your-file.pdf
effectiveDate: 2024-01-15
published: true
---

# Document Name

Optional description or notes about the document.
```

### Categories

Available categories:
- `Governing Documents` - Bylaws, covenants, declarations
- `Policies` - HOA policies and rules
- `Forms` - Application forms, request forms
- `Other` - Miscellaneous documents

### Required Fields

- `title`: Document name
- `category`: One of the categories above
- `fileUrl`: Path to PDF file (starts with `/documents/files/`)
- `published`: Set to `true` to publish

### Optional Fields

- `description`: Brief description
- `effectiveDate`: When the document became effective
- `slug`: Custom URL slug

## 📝 Editing Existing Content

### News Articles

1. Find the file in `src/content/news/`
2. Edit the Markdown file
3. Save, commit, and push

### Documents

1. Find the file in `src/content/documents/`
2. Edit metadata or description
3. To update PDF: Replace file in `public/documents/files/` and update `fileUrl` if needed
4. Save, commit, and push

## 🗑️ Removing Content

### Unpublish (Keep File)

Set `published: false` in the frontmatter.

### Delete Permanently

1. Delete the Markdown file from `src/content/`
2. If it's a document, optionally delete the PDF from `public/documents/files/`
3. Commit and push

## 📋 Content Best Practices

### News Articles

- Use descriptive filenames: `YYYY-MM-DD-topic.md`
- Keep summaries concise (1-2 sentences)
- Use tags to categorize articles
- Include dates for time-sensitive content

### Documents

- Use clear, descriptive titles
- Keep descriptions brief
- Update `effectiveDate` when documents are revised
- Organize PDFs logically in `public/documents/files/`

### Markdown Tips

- Use headings (`#`, `##`) for structure
- Use lists for multiple items
- Use **bold** for emphasis
- Use [links](url) for external references

## 🔍 Previewing Changes

Before deploying:

```bash
npm run dev
```

Visit http://localhost:4321 to preview your changes.

## 📚 Related Documentation

- `DEPLOYMENT.md` - Deployment guide
- `ENVIRONMENT_VARIABLES.md` - Environment variable setup
- `README.md` - Project overview
