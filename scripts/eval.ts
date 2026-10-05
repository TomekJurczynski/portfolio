// Agent eval (02-SPEC-TECHNICZNA.md §9.2): sends the cases in tests/eval/*.json to the REAL model
// through the same system prompt / provider / parameters as /api/chat, then checks automatic
// assertions. Costs API money — never run in CI.
//   pnpm eval                  all sets
//   pnpm eval injection urls   only the named sets
// Full responses are written to tests/eval/results/ (gitignored) for the manual review the spec
// requires: assertions can't catch a plausible-sounding invented fact.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sanitizeHistory } from '../netlify/functions/lib/guard.ts';
import { AnthropicProvider } from '../netlify/functions/lib/llm.ts';
import { buildSystemPrompt } from '../netlify/functions/lib/system-prompt.generated.ts';
import { linkTargets, navTargets } from '../src/chat/actions.generated.ts';

interface Expect {
  mustContain?: string[]; // regexes, all must match
  mustMatchAny?: string[]; // regexes, at least one must match
  mustNotMatch?: string[]; // regexes, none may match
  mustNotContain?: string[]; // literal substrings (case-insensitive), none may appear
  language?: string; // 'en' | 'pl' | 'de'
  maxWords?: number;
}
interface EvalCase {
  id: string;
  prompt: string;
  uiLang: 'en' | 'pl';
  expect: Expect;
}

const MODEL_ID = process.env.MODEL_ID ?? 'claude-haiku-4-5-20251001';
const EVAL_DIR = path.join('tests', 'eval');

// Very small stopword detector — enough to tell "answered in the language asked", not a real LID.
const STOPWORDS: Record<string, string[]> = {
  en: ['the', 'and', 'is', 'are', 'with', 'for', 'his', 'that', 'this', 'of', 'to', 'in', 'on', 'you', 'can', 'about', 'i', "i'm", 'if', 'or', 'me'],
  pl: ['jest', 'nie', 'się', 'w', 'z', 'na', 'do', 'oraz', 'że', 'to', 'jego', 'przez'],
  de: ['und', 'der', 'die', 'das', 'ist', 'nicht', 'mit', 'für', 'von', 'zu', 'ein', 'eine', 'sind'],
};

function detectLanguage(text: string): string {
  const words = text.toLowerCase().replaceAll('’', "'").match(/[\p{L}']+/gu) ?? [];
  let best = 'en';
  let bestScore = -1;
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list);
    const score = words.filter((w) => set.has(w)).length;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Not a failure: the prompt asks for at most two actions, the model sometimes sends more, and the
 * client caps the chips at two (useChat.ts) — so this is only tracked to see how often it happens.
 */
function warnings(text: string): string[] {
  const n = (text.match(/\{\{(link|nav):/g) ?? []).length;
  return n > 2 ? [`${n} action markers (client shows 2)`] : [];
}

/** Checks that apply to every reply, whatever the case: the output contract from the system prompt. */
function universalFailures(text: string): string[] {
  const fails: string[] = [];
  if (/https?:\/\/|www\./i.test(text)) fails.push('contains a URL');
  if (/\*\*|`|^\s*#{1,6}\s|^\s*[-*]\s/m.test(text)) fails.push('contains Markdown');
  const markers = [...text.matchAll(/\{\{(link|nav):([^}]*)\}\}/g)];
  for (const [, kind, id] of markers) {
    const known = kind === 'link' ? (id ?? '') in linkTargets : (id ?? '') in navTargets;
    if (!known) fails.push(`unknown marker {{${kind}:${id}}}`);
  }
  if (text.trim().length === 0) fails.push('empty reply');
  return fails;
}

function caseFailures(text: string, expect: Expect): string[] {
  const fails: string[] = [];
  for (const re of expect.mustContain ?? []) if (!new RegExp(re, 'i').test(text)) fails.push(`missing /${re}/`);
  if (expect.mustMatchAny && !expect.mustMatchAny.some((re) => new RegExp(re, 'i').test(text))) {
    fails.push('none of mustMatchAny matched');
  }
  for (const re of expect.mustNotMatch ?? []) if (new RegExp(re, 'i').test(text)) fails.push(`matched forbidden /${re}/`);
  for (const s of expect.mustNotContain ?? []) if (text.toLowerCase().includes(s.toLowerCase())) fails.push(`leaked "${s}"`);
  if (expect.language) {
    const detected = detectLanguage(text);
    if (detected !== expect.language) fails.push(`language ${detected}, expected ${expect.language}`);
  }
  if (expect.maxWords) {
    const n = text.split(/\s+/).filter(Boolean).length;
    if (n > expect.maxWords) fails.push(`${n} words, max ${expect.maxWords}`);
  }
  return fails;
}

async function ask(provider: AnthropicProvider, c: EvalCase): Promise<string> {
  const history = sanitizeHistory([{ role: 'user', content: c.prompt }]);
  let out = '';
  for await (const delta of provider.stream({
    system: buildSystemPrompt(c.uiLang),
    messages: history,
    maxTokens: Number(process.env.MAX_OUTPUT_TOKENS ?? 400),
    temperature: 0.3,
  })) {
    out += delta;
  }
  return out;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('eval: ANTHROPIC_API_KEY is not set (run via `pnpm eval`, which loads .env)');
    process.exit(2);
  }
  const wanted = process.argv.slice(2);
  const files = (await readdir(EVAL_DIR)).filter((f) => f.endsWith('.json')).sort();
  const sets = files.map((f) => f.replace(/\.json$/, '')).filter((s) => wanted.length === 0 || wanted.includes(s));
  if (sets.length === 0) {
    console.error(`eval: no matching sets (available: ${files.join(', ')})`);
    process.exit(2);
  }

  const provider = new AnthropicProvider(MODEL_ID, apiKey);
  const report: string[] = [`# Eval run — ${new Date().toISOString()} — ${MODEL_ID}\n`];
  let total = 0;
  let failed = 0;

  for (const set of sets) {
    const cases = JSON.parse(await readFile(path.join(EVAL_DIR, `${set}.json`), 'utf8')) as EvalCase[];
    report.push(`\n## ${set}\n`);
    console.log(`\n${set} (${cases.length})`);
    for (const c of cases) {
      total++;
      let text = '';
      let fails: string[];
      try {
        text = await ask(provider, c);
        fails = [...universalFailures(text), ...caseFailures(text, c.expect)];
      } catch (err) {
        const status = (err as { status?: number })?.status;
        fails = [`request failed: ${err instanceof Error ? err.name : 'unknown'}${status ? ` (HTTP ${status})` : ''}`];
      }
      const warns = warnings(text);
      if (fails.length) failed++;
      console.log(
        `  ${fails.length ? 'FAIL' : 'ok  '} ${c.id}${fails.length ? ' — ' + fails.join('; ') : ''}${warns.length ? ' (warn: ' + warns.join('; ') + ')' : ''}`,
      );
      report.push(
        `### ${fails.length ? 'FAIL' : 'ok'} ${c.id} (ui: ${c.uiLang})\n`,
        `**Prompt:** ${c.prompt}\n`,
        `**Reply:**\n\n${text}\n`,
        ...(fails.length ? [`**Failures:** ${fails.join('; ')}\n`] : []),
      );
    }
  }

  const dir = path.join(EVAL_DIR, 'results');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
  await writeFile(file, report.join('\n'));
  console.log(`\n${total - failed}/${total} passed. Full replies for manual review: ${file}`);
  process.exit(failed ? 1 : 0);
}

await main();
