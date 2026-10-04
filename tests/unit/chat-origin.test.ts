import { describe, expect, it } from 'vitest';
import { isOriginAllowed, parseAllowedOrigins } from '../../netlify/functions/lib/origin';

describe('origin allow-list', () => {
  const allowed = parseAllowedOrigins('https://site.example, https://*--site.netlify.app');

  it('accepts exact and wildcard-hostname matches', () => {
    expect(isOriginAllowed('https://site.example', allowed)).toBe(true);
    expect(isOriginAllowed('https://deploy-preview-3--site.netlify.app', allowed)).toBe(true);
  });

  it('rejects lookalikes and other schemes', () => {
    expect(isOriginAllowed('https://site.example.evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('http://site.example', allowed)).toBe(false);
    expect(isOriginAllowed('https://evil.com/--site.netlify.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://xsite.example', allowed)).toBe(false);
    expect(isOriginAllowed('https://evil.com.--site.netlify.app', allowed)).toBe(false);
  });

  it('treats regex metacharacters in patterns literally', () => {
    expect(isOriginAllowed('https://siteXexample', parseAllowedOrigins('https://site.example'))).toBe(false);
  });
});
