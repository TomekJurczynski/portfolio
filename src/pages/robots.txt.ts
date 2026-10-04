import type { APIRoute } from 'astro';

// Generated (not a static file) because the Sitemap directive must be an absolute URL,
// and the site origin comes from astro.config's `site` (PUBLIC_SITE_URL).
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
