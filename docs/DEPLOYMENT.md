# Deployment Guide

Complete guide for deploying the Crooked Lake Reserve HOA website to Cloudflare Pages.

## ✅ Pre-Deployment Checklist

### 1. Install Dependencies
```bash
cd clrhoa-site
npm install
```

### 2. Test Locally
```bash
npm run dev
```
- Open http://localhost:4321
- Verify all pages load correctly
- Check navigation works
- Test news and documents pages

### 3. Build for Production
```bash
npm run build
```
- Verify `dist/` folder is created
- Check for any build errors
- Confirm all static assets are in `dist/`

### 4. Preview Production Build
```bash
npm run preview
```
- Test the production build locally
- Verify all links work
- Check responsive design

## 🌐 Cloudflare Pages Setup

### 5. Initialize Git Repository
```bash
git init
git add .
git commit -m "Initial commit: Crooked Lake Reserve HOA website"
```

### 6. Create GitHub Repository
1. Go to GitHub and create a new repository
2. Name it: `clrhoa-site` (or your preferred name)
3. **Do NOT** initialize with README, .gitignore, or license
4. Copy the repository URL

### 7. Push to GitHub
```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

### 8. Connect to Cloudflare Pages
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Click **Connect to Git**
4. Authorize Cloudflare to access your GitHub account
5. Select your repository: `clrhoa-site`
6. Click **Begin setup**

### 9. Configure Build Settings

**Project name:** `clrhoa-site` (or your preferred name)

**Production branch:** `main`

**Framework preset:** `Astro` (or leave as "None")

**Build command:**
```
npm run build
```

**Build output directory:**
```
dist
```

**Root directory:** (leave empty, or `/` if required)

**Node version:** `20` (recommended; repo `.nvmrc` is set to 20)

**Environment variables:** See `ENVIRONMENT_VARIABLES.md` for required variables

### 10. Deploy
1. Click **Save and Deploy**
2. Wait for the build to complete (usually 2-3 minutes)
3. Your site will be available at: `https://<project-name>.pages.dev`

## 🤖 Automated Deployment

Once the repo is connected to Cloudflare Pages, **deployment is automatic**.

| Action | Result |
|--------|--------|
| **Push to `main`** | Cloudflare runs `npm run build`, deploys the `dist/` output, and updates the live site. |
| **Push to another branch** | Cloudflare builds and deploys a **preview URL** for testing before merging to `main`. |

**Typical workflow:**
1. Make changes locally (content, code, or both)
2. Commit and push to GitHub: `git add . && git commit -m "Update news" && git push origin main`
3. Cloudflare detects the push, builds the site, and deploys automatically

## 🔗 Custom Domain Setup

### 11. Add Custom Domain
1. In Cloudflare Pages, go to your project
2. Click **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter: `clrhoa.com`
5. Follow Cloudflare's DNS configuration instructions

### 12. Configure DNS

**If domain is on Cloudflare:**
- Cloudflare will automatically configure DNS records
- Wait for DNS propagation (usually a few minutes)

**If domain is elsewhere:**
Add these DNS records:
- **Type:** CNAME
- **Name:** @ (or root domain)
- **Target:** `<project-name>.pages.dev`
- **Type:** CNAME
- **Name:** www
- **Target:** `<project-name>.pages.dev`

Wait for DNS propagation (up to 24 hours, usually minutes)

## 📋 Post-Deployment Verification

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
- [ ] Security headers are active (test at securityheaders.com)
- [ ] Sitemap is accessible (`/sitemap.xml`)

## 📝 Content Updates

- [ ] Configure contact form (StaticForms) - See `CONTACT_FORM_SETUP.md`
- [ ] Set environment variables - See `ENVIRONMENT_VARIABLES.md`
- [ ] Upload actual PDF documents to `public/documents/files/`
- [ ] Update document entries in `src/content/documents/`
- [ ] Review and update news articles
- [ ] Update contact information via environment variables

## 🔄 Ongoing Maintenance

### Adding New Content
1. Edit Markdown files in `src/content/`
2. Commit and push to GitHub
3. Cloudflare Pages automatically rebuilds and deploys

### Updating Content
1. Edit existing Markdown files
2. Commit and push changes
3. Changes deploy automatically within 2-3 minutes

### Updating Environment Variables
1. Go to Cloudflare Pages → Settings → Environment variables
2. Update variables as needed
3. Save (triggers automatic redeploy)

## 🆘 Troubleshooting

### Build Fails
- Check build logs in Cloudflare Pages dashboard
- Verify Node version is 20+
- Ensure all dependencies are in `package.json`
- Check for TypeScript errors locally first
- Run `npm run build` locally to test

### Site Not Updating
- Verify changes are pushed to `main` branch
- Check Cloudflare Pages build logs
- Clear browser cache
- Wait a few minutes for deployment to complete

### Custom Domain Not Working
- Verify DNS records are correct
- Check DNS propagation status
- Ensure SSL/TLS is enabled in Cloudflare
- Wait up to 24 hours for full DNS propagation

### "Wrangler requires Node.js v20" Error
- **Cause:** Custom deploy command may be set incorrectly
- **Fix:** Ensure deploy command is empty or set to `true` (Cloudflare Pages deploys `dist/` automatically)
- Set Node.js version to `20` in build settings

## 📞 Support

For deployment issues:
- Check Cloudflare Pages documentation
- Review build logs in Cloudflare dashboard
- Contact Cloudflare support if needed

For website content questions:
- Use the contact form on the website to reach the board securely

## Quick Reference

### Development Commands
```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm test         # Run tests
npm run audit    # Check for vulnerabilities
```

### Content Locations
- News articles: `src/content/news/`
- Documents: `src/content/documents/`
- PDF files: `public/documents/files/`

### Key Files
- Main layout: `src/layouts/BaseLayout.astro`
- Homepage: `src/pages/index.astro`
- Content config: `src/content/config.ts`

## Related Documentation

- `ENVIRONMENT_VARIABLES.md` - Environment variable setup
- `CONTACT_FORM_SETUP.md` - Contact form configuration
- `CONTENT.md` - Content management guide
- `SECURITY_HEADERS.md` - Security headers configuration
