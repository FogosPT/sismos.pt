import type { APIRoute } from 'astro';
import { getCachedCatalogue } from '../lib/catalogue';
import { workerEnv } from '../lib/env';
import { depthLong, fmtMag, magTypeLabel, placeName } from '../lib/format';
import { quakeUrl } from '../lib/links';
import { REGION_NAME } from '../lib/region';
import { isPt } from '../lib/summary';

/** Significant earthquakes of the last 30 days: M ≥ 3 in Portugal, or felt. */
export const GET: APIRoute = async ({ site }) => {
  const c = await getCachedCatalogue(workerEnv);
  const items = c.events.filter((q) => isPt(q) && ((q.magnitude ?? 0) >= 3 || q.felt)).slice(0, 50);
  const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:georss="http://www.georss.org/georss">
<channel>
  <title>sismos.pt — sismos significativos</title>
  <link>${new URL('/', site).href}</link>
  <atom:link href="${new URL('/rss.xml', site).href}" rel="self" type="application/rss+xml" />
  <description>Sismos de magnitude 3 ou mais, ou sentidos, em Portugal Continental, Açores e Madeira.</description>
  <language>pt-PT</language>
${items
  .map((q) => {
    const link = new URL(quakeUrl(q) ?? `/${q.region}`, site).href;
    const title = `M ${fmtMag(q.magnitude)} · ${placeName(q.place)}, ${REGION_NAME[q.region]}`;
    const desc = `Magnitude ${fmtMag(q.magnitude)} (${magTypeLabel(q.magType)}), profundidade ${depthLong(q.depth)}.${q.felt ? ` Sentido${q.intensity ? `, intensidade máxima ${q.intensity}` : ''}.` : ''}`;
    return `  <item>
    <title>${x(title)}</title>
    <link>${x(link)}</link>
    <guid isPermaLink="false">${x(q.id)}</guid>
    <pubDate>${new Date(q.time).toUTCString()}</pubDate>
    <description>${x(desc)}</description>
    <georss:point>${q.lat} ${q.lon}</georss:point>
  </item>`;
  })
  .join('\n')}
</channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
