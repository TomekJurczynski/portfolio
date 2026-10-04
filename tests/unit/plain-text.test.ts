import { describe, expect, it } from 'vitest';
import { extractActions, stripMarkersForDisplay } from '../../src/chat/markerParser';
import { stripMarkdown } from '../../src/chat/plainText';
import { stripForSpeech } from '../../src/voice/textChunking';

const SAMPLE = [
  '**Zawodowo (Consdata):** Eximee (platforma low-code), JavaScript, REST APIs.',
  '',
  '**Projekty osobiste:** React, TypeScript, Dexie.js.',
  '- Astro',
  '* Claude API',
  '## Specjalizacja',
  'To jest `kod` i _kursywa_ oraz [link](https://example.com).',
].join('\n');

describe('stripMarkdown', () => {
  it('removes bold, bullets, headings, code, italics and link syntax but keeps the words', () => {
    expect(stripMarkdown(SAMPLE)).toBe(
      [
        'Zawodowo (Consdata): Eximee (platforma low-code), JavaScript, REST APIs.',
        '',
        'Projekty osobiste: React, TypeScript, Dexie.js.',
        'Astro',
        'Claude API',
        'Specjalizacja',
        'To jest kod i kursywa oraz link.',
      ].join('\n'),
    );
  });

  it('never leaves an asterisk behind, even an unmatched one from a half-streamed reply', () => {
    expect(stripMarkdown('**Zawodowo (Cons')).toBe('Zawodowo (Cons');
    expect(stripMarkdown('Text *')).toBe('Text ');
  });

  it('leaves plain text, hyphens, snake_case and numbered lists alone', () => {
    const plain = 'low-code, my_var_name, n8n-image-pipeline\n1. first\n2. second — dash';
    expect(stripMarkdown(plain)).toBe(plain);
  });

  it('is idempotent', () => {
    expect(stripMarkdown(stripMarkdown(SAMPLE))).toBe(stripMarkdown(SAMPLE));
  });
});

describe('Markdown never reaches the screen or the speaker', () => {
  it('streaming display', () => {
    expect(stripMarkersForDisplay('**Zawodowo:** React {{link:lex')).toBe('Zawodowo: React ');
  });
  it('final display text keeps markers extracted and drops Markdown', () => {
    const { displayText, actions } = extractActions('**Lexicon** to apka. {{link:lexicon}}');
    expect(displayText).toBe('Lexicon to apka.');
    expect(actions).toEqual([{ kind: 'link', id: 'lexicon' }]);
  });
  it('read-aloud text', () => {
    expect(stripForSpeech('**Zawodowo:** React')).toBe('Zawodowo: React');
  });
});
