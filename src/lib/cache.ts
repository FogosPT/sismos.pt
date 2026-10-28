/**
 * Edge cache around an upstream call: one call per `ttl` seconds per data
 * centre. `keep` decides whether a result is worth caching (e.g. not errors).
 * Without `caches` (tests, Node) it just calls through.
 */
export async function edgeCached<T>(
  key: string,
  ttl: number | ((v: T) => number),
  load: () => Promise<T>,
  keep: (v: T) => boolean = () => true,
): Promise<T> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const req = new Request(`https://cache.sismos.pt/${key}`);
  if (cache) {
    const hit = await cache.match(req);
    if (hit) return (await hit.json()) as T;
  }
  const value = await load();
  if (cache && keep(value)) {
    await cache.put(req, new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${typeof ttl === 'function' ? ttl(value) : ttl}` } }));
  }
  return value;
}
