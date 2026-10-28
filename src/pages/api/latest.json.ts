import type { APIRoute } from 'astro';
import { getCachedCatalogue } from '../../lib/catalogue';
import { workerEnv } from '../../lib/env';

/** Same catalogue the pages use; for the client (polling, later realtime). */
export const GET: APIRoute = async () => {
  const catalogue = await getCachedCatalogue(workerEnv, 7);
  return new Response(JSON.stringify(catalogue), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=30' },
  });
};
