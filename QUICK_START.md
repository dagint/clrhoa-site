# Quick Start Guide

## 🚀 Get Started in 5 Minutes

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

## 📝 Adding Content (For Board Members)

### Add News Article
1. Create file: `src/content/news/2026-03-15-your-title.md`
2. Copy template from `CONTENT_GUIDE.md`
3. Fill in frontmatter and content
4. Save and deploy

### Add Document
1. Upload PDF to `public/documents/files/`
2. Create file: `src/content/documents/your-doc.md`
3. Reference PDF in `fileUrl` field
4. Save and deploy

## 🌐 Deploy to Cloudflare Pages

See `DEPLOYMENT_CHECKLIST.md` for detailed instructions.

**Quick version:**
1. Push code to GitHub
2. Connect repo to Cloudflare Pages
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Deploy!

## 📚 Documentation

- `README.md` - Full project documentation
- `CONTENT_GUIDE.md` - Content management guide
- `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment
