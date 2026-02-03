import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const siteURL = site || 'https://clrhoa.com';
  
  const robotsTxt = `# Robots.txt for Crooked Lake Reserve HOA Website
# ${siteURL}/robots.txt

User-agent: *
Allow: /

# Disallow admin/private areas (if any are added in future)
# Disallow: /admin/
# Disallow: /private/

# Sitemap
Sitemap: ${siteURL}/sitemap.xml

# Crawl-delay (optional, adjust if needed)
# Crawl-delay: 1
`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
