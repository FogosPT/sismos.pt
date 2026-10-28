import { env } from 'cloudflare:workers';
import type { CatalogueEnv } from './catalogue';

/** Worker bindings: FOGOS_API_KEY (secret), FOGOS_API_BASE / FOGOS_API_HEADER (vars, optional). */
export const workerEnv = env as unknown as CatalogueEnv;
