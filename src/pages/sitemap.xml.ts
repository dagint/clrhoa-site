import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const siteURL = site || 'https://clrhoa.com';
  
  // Get all published news articles
  const newsItems = await getCollection('news', ({ data }) => {
    return data.published === true;
  });

  // Static pages
  const staticPages = [
    '',
    '/about',
    '/board',
    '/news',
    '/documents',
    '/dues',
    '/arb-process',
    '/voting',
    '/resources',
    '/resources/hurricane',
    '/resources/law',
    '/resources/emergency-contacts',
    '/resources/pest-control',
    '/resources/local-resources',
    '/resources/vendors',
    '/resources/map',
    '/resources/water-restrictions',
    '/resources/wildlife-safety',
    '/resources/flood-insurance',
    '/resources/faq',
    '/contact',
    '/privacy',
  ];

  // Generate URLs for news articles
  const newsUrls = newsItems.map((item) => {
    const slug = item.data.slug || item.id.split('/').pop()?.replace('.md', '') || item.id;
    return {
      loc: `${siteURL}/news/${slug}`,
      lastmod: item.data.date ? item.data.date.toISOString() : new Date().toISOString(),
      changefreq: 'monthly' as const,
      priority: 0.7,
    };
  });

  // Generate URLs for static pages
  const staticUrls = staticPages.map((path) => {
    const priority = path === '' ? 1.0 : path === '/news' || path === '/documents' ? 0.9 : 0.8;
    return {
      loc: `${siteURL}${path}`,
      lastmod: new Date().toISOString(),
      changefreq: path === '' ? 'weekly' as const : 'monthly' as const,
      priority,
    };
  });

  // Combine all URLs
  const allUrls = [...staticUrls, ...newsUrls];

  // Generate XML sitemap
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
};
