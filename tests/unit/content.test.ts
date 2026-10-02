import { describe, expect, it } from 'vitest';
import { LANGS } from '../../src/content/schema';
import { loadCv, loadProfile, loadProjects, loadSite } from '../../src/content/loader';

describe('content/ validates against the schemas', () => {
  it('parses site.json', () => {
    expect(loadSite().ownerName).toBe('Tomasz Jurczyński');
  });

  it.each(LANGS)('parses profile.md and cv.md for %s', (lang) => {
    expect(loadProfile(lang).frontmatter.tagline.length).toBeGreaterThan(0);
    expect(loadCv(lang).experience.length).toBeGreaterThan(0);
  });

  it.each(LANGS)('parses projects for %s and keeps ids in sync across languages', (lang) => {
    const projects = loadProjects(lang);
    expect(projects.length).toBeGreaterThan(0);
    const ids = projects.map((p) => p.frontmatter.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has the same project ids in en and pl', () => {
    const enIds = loadProjects('en')
      .map((p) => p.frontmatter.id)
      .sort();
    const plIds = loadProjects('pl')
      .map((p) => p.frontmatter.id)
      .sort();
    expect(plIds).toEqual(enIds);
  });
});
