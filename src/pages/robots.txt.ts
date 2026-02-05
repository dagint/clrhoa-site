import type { APIRoute } from 'astro';

// Only use standard robots.txt directives: User-agent, Allow, Disallow, Sitemap.
// Non-standard directives (e.g. Content-Signal) are invalid and cause validator errors.

export const GET: APIRoute = ({ site }) => {
  const siteURL = site || 'https://clrhoa.com';

  const robotsTxt = `# Crooked Lake Reserve HOA
# ${siteURL}/robots.txt

User-agent: *
Allow: /

# Sitemap
Sitemap: ${siteURL}/sitemap.xml
`;

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
