// Origin allow-list check (02-SPEC-TECHNICZNA.md §7.4): ALLOWED_ORIGINS is a
// comma-separated list that may contain a single `*` wildcard in the hostname,
// e.g. "https://*--sitename.netlify.app" to cover every deploy preview.
export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((pattern) => {
    if (!pattern.includes('*')) return pattern === origin;
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(origin);
  });
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
