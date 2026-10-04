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
  // Intrinsic size, only needed for non-phone images (phone screenshots default to 720×1529).
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

// `mobile`: a phone-app card (3-up grid, screenshots + live app link).
// `featured` / `workflow`: a full-width 3-column row (text over 2 columns, one image column);
// shown above / below the mobile grid. Those have no live app, so `url` is optional for them.
export const PROJECT_LAYOUTS = ['mobile', 'featured', 'workflow'] as const;

export const projectFrontmatterSchema = z
  .object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
  name: z.string().min(1),
  order: z.number().int(),
  layout: z.enum(PROJECT_LAYOUTS).default('mobile'),
  url: httpsUrl.optional(),
  summary: z.string().max(140),
  stack: z.array(z.string()).min(1),
  role: z.string().min(1),
  screenshots: z.array(screenshotSchema).min(1).max(3),
  })
  .superRefine((p, ctx) => {
    if (p.layout !== 'mobile') return;
    if (!p.url) ctx.addIssue({ code: 'custom', path: ['url'], message: 'mobile projects need a url' });
    if (p.screenshots.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['screenshots'], message: 'mobile projects need 2-3 screenshots' });
    }
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
