// Validates everything under content/ and generates the two files the chat
// function and the link-action whitelist are built from (02-SPEC-TECHNICZNA.md §7.3).
// Run via `pnpm run knowledge` (also part of `pnpm run build:all`).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  LANGS,
  type CvFrontmatter,
  type Lang,
  type ProfileFrontmatter,
  type ProjectFrontmatter,
  cvFrontmatterSchema,
  profileFrontmatterSchema,
  projectFrontmatterSchema,
  siteSchema,
  suggestionsSchema,
} from '../src/content/schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contentDir = join(root, 'content');
const CHAR_BUDGET = 32_000;

function fail(message: string): never {
  console.error(`✖ build-knowledge: ${message}`);
  process.exit(1);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) fail(`missing file: ${path}`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function readMd(path: string): { data: unknown; content: string } {
  if (!existsSync(path)) fail(`missing file: ${path}`);
  const { data, content } = matter(readFileSync(path, 'utf-8'));
  return { data, content: content.trim() };
}

interface ProjectEntry {
  frontmatter: ProjectFrontmatter;
  body: string;
}

function parseFaq(raw: string): { question: string; answer: string }[] {
  const entries: { question: string; answer: string }[] = [];
  let question: string | null = null;
  let answerLines: string[] = [];
  const flush = (): void => {
    if (question) entries.push({ question, answer: answerLines.join('\n').trim() });
    question = null;
    answerLines = [];
  };
  for (const line of raw.split(/\r?\n/)) {
    const heading = /^###\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      question = heading[1]?.trim() ?? null;
    } else if (question) {
      answerLines.push(line);
    }
  }
  flush();
  return entries;
}

// 1. site.json
const site = siteSchema.parse(readJson(join(contentDir, 'site.json')));

// 2. profile.md + cv.md per language
const profiles = {} as Record<Lang, { frontmatter: ProfileFrontmatter; body: string }>;
const cvs = {} as Record<Lang, CvFrontmatter>;

for (const lang of LANGS) {
  const profileFile = readMd(join(contentDir, lang, 'profile.md'));
  profiles[lang] = {
    frontmatter: profileFrontmatterSchema.parse(profileFile.data),
    body: profileFile.content,
  };

  const cvFile = readMd(join(contentDir, lang, 'cv.md'));
  cvs[lang] = cvFrontmatterSchema.parse(cvFile.data);
}

// 3. content/<lang>/projects/*.md
const projectsByLang = { en: new Map<string, ProjectEntry>(), pl: new Map<string, ProjectEntry>() };

for (const lang of LANGS) {
  const dir = join(contentDir, lang, 'projects');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
  for (const file of files) {
    const { data, content } = readMd(join(dir, file));
    const frontmatter = projectFrontmatterSchema.parse(data);
    const expectedId = file.replace(/\.md$/, '');
    if (frontmatter.id !== expectedId) {
      fail(`project id "${frontmatter.id}" does not match filename "${file}" (${lang})`);
    }
    if (projectsByLang[lang].has(frontmatter.id)) {
      fail(`duplicate project id "${frontmatter.id}" in ${lang}/projects`);
    }
    projectsByLang[lang].set(frontmatter.id, { frontmatter, body: content });
  }
}

const enIds = new Set(projectsByLang.en.keys());
const plIds = new Set(projectsByLang.pl.keys());
if (enIds.size !== plIds.size || [...enIds].some((id) => !plIds.has(id))) {
  fail(
    `project id sets differ between en/ and pl/: en=[${[...enIds].join(', ')}] pl=[${[...plIds].join(', ')}]`,
  );
}

// 4. content/en/faq.md (agent-only knowledge, not translated)
const faqPath = join(contentDir, 'en', 'faq.md');
const faqRaw = existsSync(faqPath) ? readFileSync(faqPath, 'utf-8') : '';
const faqEntries = parseFaq(faqRaw);
if (faqRaw.trim() && faqEntries.length === 0) fail('content/en/faq.md has text but no "### question" entries were parsed');

// 5. content/agent/suggestions.json
const suggestions = suggestionsSchema.parse(readJson(join(contentDir, 'agent', 'suggestions.json')));

// 6. Referenced files must exist. The CV is English-only by deliberate product
// decision (no Polish translation is planned) — only public/cv/cv-en.pdf is required.
const cvPdfPath = join(root, 'public', 'cv', 'cv-en.pdf');
if (!existsSync(cvPdfPath)) fail('missing CV PDF: public/cv/cv-en.pdf');
for (const lang of LANGS) {
  for (const { frontmatter } of projectsByLang[lang].values()) {
    for (const shot of frontmatter.screenshots) {
      const shotPath = join(root, 'public', shot.src.replace(/^\//, ''));
      if (!existsSync(shotPath)) {
        fail(`missing screenshot "${shot.src}" referenced by ${lang}/projects/${frontmatter.id}.md`);
      }
    }
  }
}

// --- Build the knowledge text fed to the model (English source only, §7.1) ---
const enProjects = [...projectsByLang.en.values()].sort(
  (a, b) => a.frontmatter.order - b.frontmatter.order,
);

const experienceLines = cvs.en.experience
  .map((e) => `- ${e.role} at ${e.company} (${e.start} to ${e.end}): ${e.bullets.join('; ')}`)
  .join('\n');
const educationLines = cvs.en.education
  .map((e) => `- ${e.degree}, ${e.school} (${e.start} to ${e.end})`)
  .join('\n');
const projectBlocks = enProjects
  .map(
    (p) =>
      `### ${p.frontmatter.name} (id: ${p.frontmatter.id})\n` +
      `Summary: ${p.frontmatter.summary}\n` +
      `Stack: ${p.frontmatter.stack.join(', ')}\n` +
      `Role: ${p.frontmatter.role}\n\n${p.body}`,
  )
  .join('\n\n');
const faqBlocks = faqEntries.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

const KNOWLEDGE = `# ${site.ownerName} — ${site.ownerRole}

## Profile
${profiles.en.frontmatter.tagline}
Seeking: ${profiles.en.frontmatter.seeking}
Stack: ${profiles.en.frontmatter.stack.join(', ')}

${profiles.en.body}

## Experience
${experienceLines}

## Education
${educationLines}

## Projects
${projectBlocks}

## FAQ
${faqBlocks}
`;

if (KNOWLEDGE.length > CHAR_BUDGET) {
  fail(`knowledge text is ${KNOWLEDGE.length} chars, over the ${CHAR_BUDGET}-char budget (PID/SRS §6.1)`);
}

const projectIds = [...enIds];
// Only projects with a live app can be offered as a link; every project can still be a nav target.
const linkableProjectIds = [...projectsByLang.en.values()].filter((p) => p.frontmatter.url).map((p) => p.frontmatter.id);
const ALLOWED_LINK_IDS = [...linkableProjectIds, 'cv', 'email', 'linkedin'];
const ALLOWED_NAV_IDS = ['top', 'about', 'apps', 'cv', 'contact', ...projectIds.map((id) => `app-${id}`)];

// --- netlify/functions/lib/knowledge.generated.ts (consumed by /api/chat in M1) ---
const knowledgeOutPath = join(root, 'netlify', 'functions', 'lib', 'knowledge.generated.ts');
mkdirSync(dirname(knowledgeOutPath), { recursive: true });
writeFileSync(
  knowledgeOutPath,
  `// Generated by scripts/build-knowledge.ts — do not edit by hand.\n` +
    `export const KNOWLEDGE = ${JSON.stringify(KNOWLEDGE)};\n` +
    `export const ALLOWED_LINK_IDS = ${JSON.stringify(ALLOWED_LINK_IDS)} as const;\n` +
    `export const ALLOWED_NAV_IDS = ${JSON.stringify(ALLOWED_NAV_IDS)} as const;\n` +
    `export const SUGGESTIONS = ${JSON.stringify(suggestions)} as const;\n`,
  'utf-8',
);

// --- src/chat/actions.generated.ts (consumed by the chat widget in M2) ---
// `cv` always points at the English PDF: the CV is English-only by deliberate
// product decision (no Polish translation is planned), on both site languages.
const linkTargets: Record<string, { href: string; external: boolean }> = {
  cv: { href: '/cv/cv-en.pdf', external: false },
  email: { href: `mailto:${site.email}`, external: false },
  linkedin: { href: site.links.linkedin, external: true },
};
for (const [id, entry] of projectsByLang.en) {
  if (entry.frontmatter.url) linkTargets[id] = { href: entry.frontmatter.url, external: true };
}

const navTargets: Record<string, string> = {
  top: '#top',
  about: '#about',
  apps: '#apps',
  cv: '#cv',
  contact: '#contact',
};
for (const id of projectIds) navTargets[`app-${id}`] = `#app-${id}`;

// Display labels for action chips in the chat widget (e.g. "Lexicon" instead of
// the raw id "lexicon"). Project names come from content; the rest are fixed
// English labels — nav/section labels are localized client-side from i18n
// instead (they already have EN/PL strings there), these four don't need to be.
const linkLabels: Record<string, string> = {
  cv: 'CV',
  email: 'Email',
  linkedin: 'LinkedIn',
};
for (const [id, entry] of projectsByLang.en) {
  if (entry.frontmatter.url) linkLabels[id] = entry.frontmatter.name;
}

const actionsOutPath = join(root, 'src', 'chat', 'actions.generated.ts');
mkdirSync(dirname(actionsOutPath), { recursive: true });
writeFileSync(
  actionsOutPath,
  `// Generated by scripts/build-knowledge.ts — do not edit by hand.\n` +
    `export const linkTargets = ${JSON.stringify(linkTargets, null, 2)} as const;\n` +
    `export const navTargets = ${JSON.stringify(navTargets, null, 2)} as const;\n` +
    `export const linkLabels = ${JSON.stringify(linkLabels, null, 2)} as const;\n`,
  'utf-8',
);

// --- netlify/functions/lib/system-prompt.generated.ts (consumed by chat.ts) ---
// Renders content/agent/system-prompt.md with everything known at build time
// substituted, leaving only {UI_LANG} as a runtime slot (set per-request from
// the client's uiLang field) — the function never needs to read content/ itself.
const systemPromptRaw = readFileSync(join(contentDir, 'agent', 'system-prompt.md'), 'utf-8');
const allowedIdsText = `link ids: ${ALLOWED_LINK_IDS.join(', ')} | nav ids: ${ALLOWED_NAV_IDS.join(', ')}`;
const systemPromptTemplate = systemPromptRaw
  .replaceAll('{OWNER_NAME}', site.ownerName)
  .replaceAll('{OWNER_ROLE}', site.ownerRole)
  .replaceAll('{ALLOWED_IDS}', allowedIdsText)
  .replace('{KNOWLEDGE}', KNOWLEDGE);

const systemPromptOutPath = join(root, 'netlify', 'functions', 'lib', 'system-prompt.generated.ts');
writeFileSync(
  systemPromptOutPath,
  `// Generated by scripts/build-knowledge.ts — do not edit by hand.\n` +
    `const TEMPLATE = ${JSON.stringify(systemPromptTemplate)};\n\n` +
    `export function buildSystemPrompt(uiLang: 'en' | 'pl'): string {\n` +
    `  return TEMPLATE.replace('{UI_LANG}', uiLang);\n` +
    `}\n`,
  'utf-8',
);

console.log(
  `✔ build-knowledge: ${projectIds.length} project(s), knowledge text ${KNOWLEDGE.length}/${CHAR_BUDGET} chars`,
);
