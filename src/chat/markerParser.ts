// Action-marker handling (02-SPEC-TECHNICZNA.md §6.4): the model emits
// {{link:<id>}} / {{nav:<id>}} instead of URLs. Markers are never shown as raw
// text — not even a momentarily-incomplete one split across a stream chunk.
import { stripMarkdown } from './plainText';
import type { ChatAction } from './types';

const MARKER_RE = /\{\{(link|nav):([a-z0-9-]+)\}\}/g;

/**
 * Strips complete markers from in-progress streamed text, and hides a trailing
 * marker that hasn't closed yet (so `{{link:le` never flashes on screen while
 * waiting for the rest of the token to arrive).
 */
export function stripMarkersForDisplay(rawText: string): string {
  const withoutComplete = rawText.replace(MARKER_RE, '');
  const lastOpen = withoutComplete.lastIndexOf('{{');
  if (lastOpen !== -1 && !withoutComplete.slice(lastOpen).includes('}}')) {
    return stripMarkdown(withoutComplete.slice(0, lastOpen));
  }
  return stripMarkdown(withoutComplete);
}

/**
 * Final pass once a stream completes: extracts up to two actions (extras are
 * dropped, per spec) and returns the marker-free display text.
 */
export function extractActions(rawText: string): { displayText: string; actions: ChatAction[] } {
  const actions: ChatAction[] = [];
  const displayText = stripMarkdown(rawText)
    .replace(MARKER_RE, (_match, kind: 'link' | 'nav', id: string) => {
      if (actions.length < 2) actions.push({ kind, id });
      return '';
    })
    .replace(/ {2,}/g, ' ')
    .trim();
  return { displayText, actions };
}
