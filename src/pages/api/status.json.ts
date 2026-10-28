import type { APIRoute } from 'astro';
import { getCatalogue } from '../../lib/catalogue';
import { workerEnv } from '../../lib/env';

/**
 * Diagnostics: asks the sources now (no edge cache) and says which one
 * answered and why the ones before it were skipped.
 */
export const GET: APIRoute = async () => {
  const started = Date.now();
  const c = await getCatalogue(workerEnv, 1);
  return new Response(
    JSON.stringify({ source: c.source, events: c.events.length, errors: c.errors ?? [], ms: Date.now() - started, apiKey: Boolean(workerEnv.FOGOS_API_KEY) }, null, 2),
    { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
};
