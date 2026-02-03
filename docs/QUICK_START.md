# Quick Start Guide

Get started with the Crooked Lake Reserve HOA website in 5 minutes.

## 🚀 Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

Visit http://localhost:4321

### 3. Build for Production
```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```

## 📝 Adding Content

### Add News Article
1. Create file: `src/content/news/2026-03-15-your-title.md`
2. Copy template from [Content Guide](CONTENT.md)
3. Fill in frontmatter and content
4. Save and deploy

### Add Document
1. Upload PDF to `public/documents/files/`
2. Create file: `src/content/documents/your-doc.md`
3. Reference PDF in `fileUrl` field
4. Save and deploy

## 🌐 Deploy to Cloudflare Pages

See [Deployment Guide](DEPLOYMENT.md) for detailed instructions.

**Quick version:**
1. Push code to GitHub
2. Connect repo to Cloudflare Pages
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Configure environment variables (see [Environment Variables](ENVIRONMENT_VARIABLES.md))
6. Deploy!

## 📚 Documentation

- **[README.md](../README.md)** - Full project documentation
- **[Content Guide](CONTENT.md)** - Content management guide
- **[Deployment Guide](DEPLOYMENT.md)** - Step-by-step deployment
- **[Security Guide](SECURITY.md)** - Security documentation

## 🛠️ Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
npm run audit        # Check for vulnerabilities
npm run sri          # Generate SRI hash
```

## ✅ Next Steps

1. ✅ Install dependencies
2. ✅ Test locally (`npm run dev`)
3. ✅ Review [Content Guide](CONTENT.md) for content management
4. ✅ Set up environment variables (see [Environment Variables](ENVIRONMENT_VARIABLES.md))
5. ✅ Deploy to Cloudflare Pages (see [Deployment Guide](DEPLOYMENT.md))
