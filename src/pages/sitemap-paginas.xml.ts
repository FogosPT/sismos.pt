import type { APIRoute } from 'astro';
import { workerEnv } from '../lib/env';
import { yearCounts } from '../lib/history';
import { REGIONS } from '../lib/types';

/** Static pages, regions, statistics and one page per year with earthquakes. */
export const GET: APIRoute = async ({ site }) => {
  const always = ['/', ...REGIONS.map((r) => `/${r}`)];
  const daily = ['/estatisticas', ...REGIONS.map((r) => `/estatisticas/${r}`), '/historico'];
  const monthly = ['/fontes', '/sobre', '/o-que-fazer'];

  let years: number[] = [];
  try {
    years = (await yearCounts(workerEnv))?.years.map((y) => y.year) ?? [];
  } catch {
    /* the static part is still worth serving */
  }
  const thisYear = new Date().getUTCFullYear();

  const url = (p: string, freq: string) => `  <url><loc>${new URL(p, site).href}</loc><changefreq>${freq}</changefreq></url>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...always.map((p) => url(p, 'always')),
    ...daily.map((p) => url(p, 'daily')),
    ...monthly.map((p) => url(p, 'monthly')),
    ...years.map((y) => url(`/historico/${y}`, y === thisYear ? 'daily' : 'yearly')),
  ].join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
