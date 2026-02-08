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
├── public/              # Static assets; .well-known/security.txt
├── src/
│   ├── components/     # Reusable UI (PortalNav, ProtectedPage, etc.)
│   ├── content/        # Content collections (news, documents)
│   ├── layouts/        # BaseLayout, PortalLayout, BoardLayout
│   ├── lib/            # Auth, API helpers, portal context, access control, DB helpers, sanitize, rate-limit
│   ├── middleware.ts   # Portal/board auth gates + security headers
│   ├── pages/          # Routes (public, /portal/*, /board/*, /api/*)
│   └── styles/         # Global CSS
├── docs/               # Documentation (security, deployment, architecture)
├── scripts/            # DB migrations, build helpers
├── tests/              # Unit tests (Vitest)
├── astro.config.mjs
└── package.json
```

See **docs/ARCHITECTURE.md** for public vs portal vs board and key libs.

## 📝 Content Management

See **[Content Guide](docs/CONTENT.md)** for complete instructions on adding and updating content.

**Quick reference:**
- News articles: `src/content/news/` (format: `YYYY-MM-DD-slug.md`)
- Documents: `src/content/documents/` (PDFs in `public/documents/files/`)

## 🏗️ Building for Production

```bash
npm run build
```

This generates a static site in the `dist/` directory, ready for deployment.

## 🌐 Deployment

See **[Deployment Guide](docs/DEPLOYMENT.md)** for complete deployment instructions.

**Quick setup:**
1. Push code to GitHub
2. Connect to Cloudflare Pages
3. Configure environment variables (see `docs/ENVIRONMENT_VARIABLES.md`)
4. Deploy automatically on push to `main`

## 🔒 Security

- **Public site**: Largely static; only non-PII data and `PUBLIC_*` env; no session or secrets on the client.
- **Member portal & board**: Server-rendered with session auth (signed cookies, KV whitelist), role-based access, and rate limiting. Data and file access are documented and enforced via centralized helpers.

### Security Features

- ✅ Security headers (CSP, HSTS, X-Frame-Options, etc.) in middleware
- ✅ Session auth with optional fingerprint; login rate limit and account lockout
- ✅ CSRF and origin checks on mutating APIs; centralized ARB access control
- ✅ StaticForms contact form with honeypot and optional reCAPTCHA
- ✅ Input sanitization; parameterized DB queries; member-doc file keys validated
- ✅ robots.txt and security.txt; Dependabot for dependency updates
- ✅ HTTPS/SSL via Cloudflare; SRI for external scripts where applicable
- ✅ Security and data-access documentation (see docs)

See **[Security Guide](docs/SECURITY.md)** and **[Security Assessment](docs/SECURITY_ASSESSMENT.md)** for full documentation.

## 📊 Analytics (Optional)

Privacy-friendly analytics can be enabled via environment variables. See `docs/ANALYTICS_SETUP.md` for setup instructions.

## 🗺️ Sitemap

A sitemap is automatically generated at `/sitemap.xml` and includes all published pages and news articles.

## 📚 Documentation

Complete documentation is available in the `docs/` folder:

- **[Documentation Index](docs/README.md)** - Overview of all documentation
- **[Quick Start](docs/QUICK_START.md)** - Get started in 5 minutes
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Complete deployment instructions
- **[Content Guide](docs/CONTENT.md)** - Content management
- **[Security Guide](docs/SECURITY.md)** - Security documentation
- **[Environment Variables](docs/ENVIRONMENT_VARIABLES.md)** - Environment variable setup

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run astro` - Run Astro CLI commands
- `npm test` - Run tests in watch mode
- `npm test -- --run` - Run tests once
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

### Tech Stack

- **Astro** - Static site generator
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Content Collections** - Type-safe content management

## 📞 Support

For questions about the website or content updates, please use the contact form on the website to reach the board securely.

## 📄 License

Copyright © 2026 Crooked Lake Reserve HOA. All rights reserved.
