import { cache, GoogleFont, ImageResponse } from '@cf-wasm/og/workerd';
import type { APIRoute } from 'astro';
import { edgeCached } from '../../lib/cache';
import { fogosOptions } from '../../lib/catalogue';
import { workerEnv } from '../../lib/env';
import { quakeCard, siteCard } from '../../lib/og';
import { fogosDetail } from '../../lib/sources/fogos';

/** 1200×630 share cards: /og/sismos.png (site) and /og/<earthquake id>.png. */
export const GET: APIRoute = async ({ params, locals }) => {
  const ctx = (locals as { cfContext?: ExecutionContext }).cfContext;
  if (ctx) cache.setExecutionContext(ctx);

  let node;
  if (params.name === 'sismos') {
    node = siteCard();
  } else if (/^[a-f0-9]{24}$/.test(params.name ?? '')) {
    const q = await edgeCached(`sismo/${params.name}`, 300, () => fogosDetail(params.name!, fogosOptions(workerEnv)), (v) => v !== null);
    if (!q) return new Response(null, { status: 404 });
    node = quakeCard(q);
  } else {
    return new Response(null, { status: 404 });
  }

  const img = await ImageResponse.async(node as any, {
    width: 1200,
    height: 630,
    fonts: [new GoogleFont('Fraunces', { weight: 400 }), new GoogleFont('Geist Mono', { weight: 400 })],
  });
  const headers = new Headers(img.headers);
  headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return new Response(img.body, { status: img.status, headers });
};
