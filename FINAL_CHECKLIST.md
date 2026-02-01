# Final Deployment Checklist

## ✅ Installation & Setup

- [ ] **Install dependencies:**
  ```bash
  cd clrhoa-site
  npm install
  ```

- [ ] **Test locally:**
  ```bash
  npm run dev
  ```
  - Open http://localhost:4321
  - Verify all pages load
  - Test navigation
  - Check news and documents pages

- [ ] **Build for production:**
  ```bash
  npm run build
  ```
  - Verify `dist/` folder is created
  - Check for build errors

## 🔧 Git Setup

- [ ] **Initialize Git repository:**
  ```bash
  git init
  git add .
  git commit -m "Initial commit: Crooked Lake Reserve HOA website"
  ```

- [ ] **Create GitHub repository:**
  - Go to GitHub and create new repository
  - Name: `clrhoa-site` (or your choice)
  - **Do NOT** initialize with README/license

- [ ] **Push to GitHub:**
  ```bash
  git remote add origin <your-github-repo-url>
  git branch -M main
  git push -u origin main
  ```

## 🌐 Cloudflare Pages Configuration

### Build Settings

- [ ] **Framework preset:** `Astro` (or "None")
- [ ] **Build command:** `npm run build`
- [ ] **Build output directory:** `dist`
- [ ] **Root directory:** (leave empty)
- [ ] **Node version:** `18` (or higher)
- [ ] **Environment variables:** (none required)

### Deployment Steps

- [ ] Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
- [ ] Navigate to **Pages** → **Create a project**
- [ ] Click **Connect to Git**
- [ ] Authorize Cloudflare to access GitHub
- [ ] Select repository: `clrhoa-site`
- [ ] Configure build settings (see above)
- [ ] Click **Save and Deploy**
- [ ] Wait for build to complete (2-3 minutes)

## 🔗 Custom Domain Setup

- [ ] **Add custom domain:**
  - In Cloudflare Pages project → **Custom domains** tab
  - Click **Set up a custom domain**
  - Enter: `clrhoa.com`
  - Follow DNS configuration instructions

- [ ] **Configure DNS:**
  - If domain is on Cloudflare: Auto-configured
  - If domain is elsewhere: Add CNAME records:
    - `@` → `<project-name>.pages.dev`
    - `www` → `<project-name>.pages.dev`

- [ ] **Wait for DNS propagation** (up to 24 hours, usually minutes)

## 📝 Content Updates

- [ ] Update contact information in `src/pages/contact.astro`
- [ ] Add real board member information in `src/pages/board.astro`
- [ ] Upload actual PDF documents to `public/documents/files/`
- [ ] Update document entries in `src/content/documents/`
- [ ] Review and update news articles
- [ ] Update mailing address and contact details

## ✅ Post-Deployment Verification

- [ ] Homepage loads correctly
- [ ] All navigation links work
- [ ] News page displays articles
- [ ] Individual news articles load
- [ ] Documents page shows documents
- [ ] Document PDFs are accessible
- [ ] Contact page displays correctly
- [ ] Mobile navigation works
- [ ] Responsive design works on mobile/tablet
- [ ] Custom domain works (if configured)
- [ ] HTTPS/SSL is enabled

## 📚 Documentation Review

- [ ] Read `README.md` for full documentation
- [ ] Review `CONTENT_GUIDE.md` for content management
- [ ] Share `CONTENT_GUIDE.md` with board members
- [ ] Bookmark `DEPLOYMENT_CHECKLIST.md` for reference

## 🎯 Quick Reference

### Development Commands
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Content Locations
- News articles: `src/content/news/`
- Documents: `src/content/documents/`
- PDF files: `public/documents/files/`

### Key Files
- Main layout: `src/layouts/BaseLayout.astro`
- Homepage: `src/pages/index.astro`
- Content config: `src/content/config.ts`

## 🆘 Troubleshooting

If build fails:
- Check Cloudflare Pages build logs
- Verify Node version is 18+
- Run `npm run build` locally first
- Check for TypeScript errors

If site doesn't update:
- Verify changes pushed to `main` branch
- Check Cloudflare build logs
- Wait 2-3 minutes for deployment

If custom domain doesn't work:
- Verify DNS records
- Check SSL/TLS status
- Wait for DNS propagation

## ✨ You're All Set!

Once all items are checked, your HOA website is live and ready for content updates!

For ongoing maintenance, board members can edit Markdown files in `src/content/` - changes will automatically deploy when pushed to GitHub.
