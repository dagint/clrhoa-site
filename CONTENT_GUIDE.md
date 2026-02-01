# Content Management Guide for Board Members

This guide explains how to add and update content on the HOA website without touching code.

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

Write your full article content here using Markdown.

## Section Headers

You can use headers, lists, and formatting:

- Bullet points
- **Bold text**
- *Italic text*

[Links](https://example.com) work too!
```

### Required Fields

- **title**: The article headline
- **date**: Publication date (YYYY-MM-DD format)
- **summary**: Brief description (appears on news listing)
- **published**: Set to `true` to show, `false` to hide

### Optional Fields

- **tags**: Array of tags for categorization (e.g., `["meeting", "event"]`)

## 📄 Adding Documents

### Step 1: Upload the PDF

1. Place your PDF file in `public/documents/files/`
2. Note the filename (e.g., `budget-2026.pdf`)

### Step 2: Create Document Entry

1. Navigate to `src/content/documents/`
2. Create a new file: `document-name.md`
3. Use this template:

```markdown
---
title: Document Title
category: Meeting Minutes
description: Brief description of what this document contains
fileUrl: /documents/files/your-filename.pdf
effectiveDate: 2026-01-15
published: true
---

# Document Title

Optional notes or description about the document.
```

### Categories

Choose one of these categories:
- `Governing Documents` - CC&Rs, Bylaws, etc.
- `Policies` - HOA policies and rules
- `Forms` - Forms for residents to fill out
- `Meeting Minutes` - Board meeting minutes
- `Other` - Everything else

### Required Fields

- **title**: Document name
- **category**: One of the categories above
- **description**: Brief description
- **fileUrl**: Path to the PDF file (starts with `/documents/files/`)
- **published**: Set to `true` to show, `false` to hide

### Optional Fields

- **effectiveDate**: When the document became effective (YYYY-MM-DD)

## 🔄 Updating Existing Content

1. Find the file in `src/content/news/` or `src/content/documents/`
2. Edit the Markdown file
3. Save your changes
4. The site will automatically update after deployment

## 🚫 Unpublishing Content

To hide content without deleting it:

1. Open the content file
2. Change `published: true` to `published: false`
3. Save the file

## ✅ Best Practices

- Use descriptive filenames
- Keep summaries concise (1-2 sentences)
- Use consistent date formats (YYYY-MM-DD)
- Test locally before deploying (ask a technical person if needed)
- Keep document descriptions brief but informative

## 🆘 Need Help?

If you're unsure about anything:
1. Look at existing files as examples
2. Contact the website administrator
3. Don't modify files outside of `src/content/` unless you know what you're doing
