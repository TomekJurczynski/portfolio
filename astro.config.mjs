import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // `|| ` (not `??`) on purpose: an unset PUBLIC_SITE_URL in .env.example / a
  // freshly copied local .env resolves to an empty string once env vars are
  // injected (e.g. by `netlify dev`), not `undefined` — only `||` falls back then.
  site: process.env.PUBLIC_SITE_URL || 'https://example.netlify.app',
  integrations: [react(), sitemap()],
  output: 'static',
});
