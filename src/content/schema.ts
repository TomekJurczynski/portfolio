// Zod schemas for everything under content/ (02-SPEC-TECHNICZNA.md §7.2).
// Used by scripts/build-knowledge.ts at build time and by content unit tests.
import { z } from 'zod';

const httpsUrl = z.string().url().startsWith('https://');
const yyyyMm = z.string().regex(/^\d{4}-\d{2}$/, 'expected YYYY-MM');

export const siteSchema = z.object({
  ownerName: z.string().min(1),
  ownerRole: z.string().min(1),
  pronoun: z.enum(['he', 'she', 'they']),
  email: z.string().email(),
  links: z.object({
    linkedin: httpsUrl,
  }),
  siteUrl: httpsUrl,
});
export type Site = z.infer<typeof siteSchema>;

export const profileFrontmatterSchema = z.object({
  tagline: z.string().max(160),
  seeking: z.string().max(200),
  stack: z.array(z.string()).max(20),
  photo: z.string().optional(),
});
export type ProfileFrontmatter = z.infer<typeof profileFrontmatterSchema>;

export const experienceEntrySchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  start: yyyyMm,
  end: z.union([yyyyMm, z.literal('present')]),
  bullets: z.array(z.string()).min(1),
});

export const educationEntrySchema = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  start: yyyyMm,
  end: yyyyMm,
});

export const cvFrontmatterSchema = z.object({
  experience: z.array(experienceEntrySchema).min(1),
  education: z.array(educationEntrySchema).min(1),
});
export type CvFrontmatter = z.infer<typeof cvFrontmatterSchema>;

export const screenshotSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
});

export const projectFrontmatterSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
  name: z.string().min(1),
  order: z.number().int(),
  url: httpsUrl,
  summary: z.string().max(140),
  stack: z.array(z.string()).min(1),
  role: z.string().min(1),
  screenshots: z.array(screenshotSchema).min(2).max(3),
});
export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;

export const faqEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
export type FaqEntry = z.infer<typeof faqEntrySchema>;

export const suggestionsSchema = z.object({
  en: z.array(z.string()).length(4),
  pl: z.array(z.string()).length(4),
});
export type Suggestions = z.infer<typeof suggestionsSchema>;

export const LANGS = ['en', 'pl'] as const;
export type Lang = (typeof LANGS)[number];
