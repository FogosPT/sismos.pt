import { env } from 'cloudflare:workers';
import type { CatalogueEnv } from './catalogue';

/** Worker bindings: FOGOS_API_KEY (secret), FOGOS_API_BASE (var, optional). */
export const workerEnv = env as unknown as CatalogueEnv;
