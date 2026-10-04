// Pure helpers for speech readout (02-SPEC-TECHNICZNA.md §5.1 step 5) — no DOM/Web
// Speech API dependency, so these are the one part of voice/ actually unit-testable
// without a real browser.
import { stripMarkdown } from '../chat/plainText';

/** Strips leftover action markers and URLs before text is spoken aloud. */
export function stripForSpeech(text: string): string {
  return stripMarkdown(text)
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Splits text into ≤maxLen chunks on sentence boundaries where possible — some
 * speech-synthesis implementations cut off long utterances, so long replies are
 * queued as several shorter ones instead of one giant one.
 */
export function chunkForSpeech(text: string, maxLen = 200): string[] {
  const sentences =
    text
      .match(/[^.!?\n]+[.!?]?(\s+|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [text.trim()];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= maxLen) {
      current = sentence;
      continue;
    }
    // A single sentence longer than maxLen: hard-split at word boundaries.
    let remainder = sentence;
    while (remainder.length > maxLen) {
      let cut = remainder.lastIndexOf(' ', maxLen);
      if (cut <= 0) cut = maxLen;
      chunks.push(remainder.slice(0, cut).trim());
      remainder = remainder.slice(cut).trim();
    }
    current = remainder;
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

/**
 * Chunking for cloud TTS, where synthesis time grows with text length (~12 ms/char): the first
 * chunk is kept short (about one sentence) so audio starts quickly, the rest is grouped into
 * larger chunks (fewer requests, smoother prosody) that are synthesized while the first plays.
 */
export function chunkForCloud(text: string, firstMin = 30, maxLen = 300): string[] {
  const sentences = text
    .match(/[^.!?\n]+[.!?]?(\s+|$)/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [text.trim()];
  let first = '';
  let used = 0;
  for (const sentence of sentences) {
    if (first && first.length >= firstMin) break;
    const candidate = first ? `${first} ${sentence}` : sentence;
    if (first && candidate.length > maxLen) break;
    first = candidate;
    used += 1;
  }
  const rest = sentences.slice(used).join(' ');
  return [...chunkForSpeech(first, maxLen), ...(rest ? chunkForSpeech(rest, maxLen) : [])];
}
