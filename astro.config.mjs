import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sismos.pt',
  output: 'server',
  // No sessions and no Cloudflare Images: nothing to provision on deploy.
  session: false,
  adapter: cloudflare({ imageService: 'passthrough' }),
  build: { format: 'directory' },
});
