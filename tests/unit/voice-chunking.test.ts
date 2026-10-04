import { describe, expect, it } from 'vitest';
import { chunkForCloud, chunkForSpeech, stripForSpeech } from '../../src/voice/textChunking';

describe('stripForSpeech', () => {
  it('removes action markers', () => {
    expect(stripForSpeech('Check it out {{link:lexicon}} today')).toBe('Check it out today');
  });

  it('removes URLs', () => {
    expect(stripForSpeech('Visit https://example.com/app for more')).toBe('Visit for more');
  });

  it('collapses extra whitespace left behind', () => {
    expect(stripForSpeech('Hello   {{link:x}}   world')).toBe('Hello world');
  });

  it('leaves plain text untouched', () => {
    expect(stripForSpeech('Nothing special here.')).toBe('Nothing special here.');
  });
});

describe('chunkForSpeech', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkForSpeech('Hello there.')).toEqual(['Hello there.']);
  });

  it('keeps every chunk at or under the max length', () => {
    const longText = Array.from({ length: 30 }, (_, i) => `This is sentence number ${i}.`).join(' ');
    const chunks = chunkForSpeech(longText, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
  });

  it('reassembles to (approximately) the original content, in order', () => {
    const text = 'First sentence here. Second sentence here. Third one too.';
    const chunks = chunkForSpeech(text, 40);
    expect(chunks.join(' ')).toContain('First sentence here.');
    expect(chunks.join(' ')).toContain('Third one too.');
  });

  it('hard-splits a single sentence longer than maxLen at a word boundary', () => {
    const word = 'supercalifragilisticexpialidocious';
    const longSentence = Array.from({ length: 10 }, () => word).join(' ') + '.';
    const chunks = chunkForSpeech(longSentence, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
      expect(chunk.startsWith(' ')).toBe(false);
    }
  });

  it('returns an empty array for empty input', () => {
    expect(chunkForSpeech('')).toEqual([]);
  });
});

describe('chunkForCloud', () => {
  const reply =
    'Tomasz pracuje w Consdata. Buduje też własne aplikacje, kierując agentami AI przez całą implementację. ' +
    'Najbardziej dumny jest z asystenta w tym portfolio, który odpowiada głosem. Chcesz wiedzieć więcej?';

  it('keeps the first chunk short so audio can start early', () => {
    const chunks = chunkForCloud(reply);
    expect(chunks[0]?.length).toBeLessThan(140);
    expect(chunks[0]).toContain('Tomasz pracuje w Consdata.');
  });

  it('loses no words and respects maxLen', () => {
    const chunks = chunkForCloud(reply, 50, 150);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(reply);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(150);
  });

  it('returns a single chunk for a short reply', () => {
    expect(chunkForCloud('Cześć!')).toEqual(['Cześć!']);
  });
});
