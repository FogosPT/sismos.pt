import { defineMiddleware } from 'astro:middleware';
import { externalLinksInNewTab } from './lib/links';

/** External links always open in a new tab, in every server-rendered page. */
export const onRequest = defineMiddleware(async (_ctx, next) => {
  const res = await next();
  if (!res.headers.get('content-type')?.includes('text/html')) return res;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  return new Response(externalLinksInNewTab(await res.text()), { status: res.status, statusText: res.statusText, headers });
});
