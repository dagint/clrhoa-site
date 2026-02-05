import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const siteURL = site || 'https://clrhoa.com';

  const newsItems = await getCollection('news', ({ data }) => data.published === true);
  const sorted = newsItems.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const items = sorted.map((item) => {
    const slug = item.data.slug || item.id.split('/').pop()?.replace('.md', '') || item.id;
    const link = `${siteURL}/news/${slug}`;
    const pubDate = item.data.date.toUTCString();
    const title = item.data.title;
    const description = escapeXml(item.data.summary ?? '');
    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
  }).join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Crooked Lake Reserve HOA – News</title>
    <link>${siteURL}/news</link>
    <description>News and updates from Crooked Lake Reserve Homeowners Association</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteURL}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
