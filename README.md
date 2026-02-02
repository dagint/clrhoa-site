# Crooked Lake Reserve HOA Website

A modern, static website for the Crooked Lake Reserve Homeowners Association built with Astro and Tailwind CSS.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url> clrhoa-site
   cd clrhoa-site
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:4321](http://localhost:4321) in your browser.

## 📁 Project Structure

```
clrhoa-site/
├── public/              # Static assets (images, PDFs, etc.)
├── src/
│   ├── content/        # Content collections (Markdown files)
│   │   ├── news/       # News articles
│   │   └── documents/  # Document metadata
│   ├── layouts/        # Layout components
│   ├── pages/          # Page routes
│   └── styles/         # Global styles
├── astro.config.mjs    # Astro configuration
├── tailwind.config.mjs # Tailwind configuration
└── package.json
```

## 📝 Content Management

### Adding News Articles

1. Create a new Markdown file in `src/content/news/`
2. Use the filename format: `YYYY-MM-DD-slug.md`
3. Include frontmatter with required fields:

```markdown
---
title: Your Article Title
date: 2026-01-15
summary: A brief summary of the article
tags:
  - tag1
  - tag2
published: true
---

# Your Article Title

Your article content here...
```

### Adding Documents

1. Upload the PDF file to `public/documents/files/`
2. Create a Markdown file in `src/content/documents/`
3. Include frontmatter:

```markdown
---
title: Document Name
category: Governing Documents
description: Brief description
fileUrl: /documents/files/your-file.pdf
effectiveDate: 2026-01-15
published: true
---

# Document Name

Optional description or notes about the document.
```

**Categories:** `Governing Documents`, `Policies`, `Forms`, `Meeting Minutes`, `Other`

## 🏗️ Building for Production

```bash
npm run build
```

This generates a static site in the `dist/` directory, ready for deployment.

## 🌐 Deployment to Cloudflare Pages

### Initial Setup

1. Push your code to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
3. Click "Create a project" → "Connect to Git"
4. Select your GitHub repository

### Build Settings

Configure the following in Cloudflare Pages:

- **Framework preset:** Astro
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** `/` (or leave empty)
- **Node version:** 18 or higher

### Environment Variables

No environment variables are required for basic deployment.

### Custom Domain

1. In Cloudflare Pages, go to your project → Custom domains
2. Add `clrhoa.com` and `www.clrhoa.com`
3. Follow Cloudflare's DNS configuration instructions

### Automatic Deployments

Cloudflare Pages automatically deploys:
- Every push to `main` branch → Production
- Pull requests → Preview deployments

## 🔒 Security Notes

- This is a static site with no server-side code
- No third-party analytics or tracking scripts included
- Board-only area has been removed for now; can be re-added with authentication later
- All content is public

## 📋 Deployment Checklist

- [ ] Install dependencies: `npm install`
- [ ] Test locally: `npm run dev`
- [ ] Build for production: `npm run build`
- [ ] Verify `dist/` folder is created
- [ ] Push code to GitHub repository
- [ ] Connect repository to Cloudflare Pages
- [ ] Set build command: `npm run build`
- [ ] Set output directory: `dist`
- [ ] Configure custom domain: `clrhoa.com`
- [ ] Test production deployment
- [ ] Update DNS records if needed

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run astro` - Run Astro CLI commands

### Tech Stack

- **Astro** - Static site generator
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Content Collections** - Type-safe content management

## 📞 Support

For questions about the website or content updates, contact the board at board@clrhoa.com.

## 📄 License

Copyright © 2026 Crooked Lake Reserve HOA. All rights reserved.
