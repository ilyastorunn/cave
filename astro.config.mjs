// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://cave.ilyastorun.site',
  output: 'server',
  // No Astro sessions: otherwise the adapter provisions an unused SESSION KV namespace.
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough',
    // No Cloudflare Images binding: images are served as uploaded from R2.
    imagesBindingName: false,
  }),
});
