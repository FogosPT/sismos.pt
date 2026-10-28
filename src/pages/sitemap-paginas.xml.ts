import type { APIRoute } from 'astro';
import { REGIONS } from '../lib/types';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const paths = ['/', ...REGIONS.map((r) => `/${r}`), '/fontes', '/sobre'];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${new URL(p, site).href}</loc><changefreq>${p === '/' || REGIONS.includes(p.slice(1) as never) ? 'always' : 'monthly'}</changefreq></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
