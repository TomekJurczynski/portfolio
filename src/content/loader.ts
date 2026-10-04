// Thin read+parse helpers over content/ for use in .astro pages.
// scripts/build-knowledge.ts intentionally does its own stricter parsing
// (uniqueness/parity checks) and does not share this module.
//
// CONTENT_ROOT is resolved from process.cwd() rather than import.meta.url:
// this module gets bundled by Vite for the Astro build, which rewrites emitted
// chunks into dist/.prerender/ — an import.meta.url-relative path would then
// point outside the project. astro dev/build/preview are always run from the
// project root, so process.cwd() is reliable here.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import {
  type CvFrontmatter,
  type Lang,
  type ProfileFrontmatter,
  type ProjectFrontmatter,
  type Site,
  cvFrontmatterSchema,
  profileFrontmatterSchema,
  projectFrontmatterSchema,
  siteSchema,
} from './schema.ts';

export const CONTENT_ROOT = join(process.cwd(), 'content');

function readMd(path: string): { data: unknown; content: string } {
  const { data, content } = matter(readFileSync(path, 'utf-8'));
  return { data, content: content.trim() };
}

export function loadSite(): Site {
  return siteSchema.parse(JSON.parse(readFileSync(join(CONTENT_ROOT, 'site.json'), 'utf-8')));
}

export function loadProfile(lang: Lang): { frontmatter: ProfileFrontmatter; body: string } {
  const { data, content } = readMd(join(CONTENT_ROOT, lang, 'profile.md'));
  return { frontmatter: profileFrontmatterSchema.parse(data), body: content };
}

export function loadCv(lang: Lang): CvFrontmatter {
  const { data } = readMd(join(CONTENT_ROOT, lang, 'cv.md'));
  return cvFrontmatterSchema.parse(data);
}

export interface ProjectEntry {
  frontmatter: ProjectFrontmatter;
  body: string;
}

/** Splits a profile.md-style body into paragraphs (blank-line separated). */
export function splitParagraphs(body: string): string[] {
  return body
    .split(/(?:\r?\n){2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export interface MarkdownSection {
  heading: string;
  text: string;
}

/** Splits a project body into its `## Heading` sections (Problem/Decisions/...). */
export function parseSections(body: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  let heading: string | null = null;
  let lines: string[] = [];
  const flush = (): void => {
    if (heading) sections.push({ heading, text: lines.join('\n').trim() });
    lines = [];
  };
  for (const line of body.split('\n')) {
    const match = /^##\s+(.+)$/.exec(line);
    if (match) {
      flush();
      heading = match[1]?.trim() ?? null;
    } else {
      lines.push(line);
    }
  }
  flush();
  return sections;
}

export function loadProjects(lang: Lang): ProjectEntry[] {
  const dir = join(CONTENT_ROOT, lang, 'projects');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, content } = readMd(join(dir, file));
      return { frontmatter: projectFrontmatterSchema.parse(data), body: content };
    })
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}
