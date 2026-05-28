import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://soniamorales.pe',
  output: 'server',
  adapter: cloudflare(),
  integrations: [vue()],
  vite: {
    css: {
      devSourcemap: true,
    },
  },
});
