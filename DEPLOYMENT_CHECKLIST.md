# Deployment Checklist for Cloudflare Pages

Follow these steps to deploy the Crooked Lake Reserve HOA website to Cloudflare Pages.

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

**Environment variables:** (none required for basic setup)

**Node version:** `20` (recommended; repo `.nvmrc` is set to 20)

### 10. Deploy
1. Click **Save and Deploy**
2. Wait for the build to complete (usually 2-3 minutes)
3. Your site will be available at: `https://<project-name>.pages.dev`

## 🤖 Automated Deployment (How It Works)

Once the repo is connected to Cloudflare Pages, **deployment is automatic**—no manual uploads or scripts.

| Action | Result |
|--------|--------|
| **Push to `main`** | Cloudflare runs `npm run build`, deploys the `dist/` output, and updates the live site. |
| **Push to another branch** (e.g. `develop`) | Cloudflare builds and deploys a **preview URL** (e.g. `https://<branch>-<project>.pages.dev`) so you can test before merging to `main`. |

**Typical workflow:**
1. Make changes locally (content, code, or both).
2. Commit and push to GitHub: `git add . && git commit -m "Update news" && git push origin main`
3. Cloudflare detects the push, builds the site, and deploys. Check the **Deployments** tab in the Cloudflare Pages dashboard for status and logs.

No GitHub Actions or extra automation is required—Cloudflare Pages handles it when connected to Git. To change build settings (e.g. Node version, env vars), use **Settings → Builds & deployments** in the Pages project.

## 🔗 Custom Domain Setup

### 11. Add Custom Domain
1. In Cloudflare Pages, go to your project
2. Click **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter: `clrhoa.com`
5. Follow Cloudflare's DNS configuration instructions

### 12. Configure DNS (if domain is on Cloudflare)
- Cloudflare will automatically configure DNS records
- Wait for DNS propagation (usually a few minutes)

### 13. Configure DNS (if domain is elsewhere)
Add these DNS records:
- **Type:** CNAME
- **Name:** @ (or root domain)
- **Target:** `<project-name>.pages.dev`
- **Type:** CNAME
- **Name:** www
- **Target:** `<project-name>.pages.dev`

## 📋 Post-Deployment Verification

### 14. Test Production Site
- [ ] Homepage loads correctly
- [ ] All navigation links work
- [ ] News page displays articles
- [ ] Documents page shows documents
- [ ] Contact page displays correctly
- [ ] Mobile navigation works
- [ ] All images and assets load
- [ ] Custom domain works (if configured)

### 15. Update Content
- [ ] Review and update contact information
- [ ] Add actual board member information
- [ ] Upload real PDF documents
- [ ] Update news articles with current information
- [ ] Verify all document links work

## 🔄 Ongoing Maintenance

### Adding New Content
1. Edit Markdown files in `src/content/`
2. Commit and push to GitHub
3. Cloudflare Pages automatically rebuilds and deploys

### Updating Content
1. Edit existing Markdown files
2. Commit and push changes
3. Changes deploy automatically within 2-3 minutes

## 🆘 Troubleshooting

### "Wrangler requires Node.js v20" or deploy command fails

If the **build** succeeds but the **deploy** step fails with a Wrangler or Node version error:

- **Cause:** A custom **deploy command** (e.g. `npx wrangler deploy`) is set in Cloudflare Pages. For a static Astro site, you don't need it—Pages deploys the `dist/` folder automatically after the build.
- **Fix (either option):**
  1. **Preferred:** Set **Deploy command** to `true` (no Wrangler; Pages deploys `dist/` automatically). Save and re-run.
  2. **If the UI requires a real deploy command:** The repo includes `wrangler.jsonc` so `npx wrangler deploy` deploys the `dist/` folder. Ensure the deploy command is exactly `npx wrangler deploy` (no extra args). Commit and push `wrangler.jsonc` if you added it, then re-run the deployment.
- **Optional:** Set **Node.js version** to `20` so the build and any future commands use Node 20 (the repo `.nvmrc` is set to 20).

### Build Fails
- Check build logs in Cloudflare Pages dashboard
- Verify Node version is 18+
- Ensure all dependencies are in `package.json`
- Check for TypeScript errors locally first

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

## 📞 Support

For deployment issues:
- Check Cloudflare Pages documentation
- Review build logs in Cloudflare dashboard
- Contact Cloudflare support if needed

For website content questions:
- Contact the board at info@clrhoa.com
