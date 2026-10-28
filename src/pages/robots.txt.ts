import type { APIRoute } from 'astro';

export const prerender = true;

// The sitemap (sismo pages) comes with #2.
export const GET: APIRoute = () => new Response('User-agent: *\nAllow: /\n', { headers: { 'Content-Type': 'text/plain' } });
