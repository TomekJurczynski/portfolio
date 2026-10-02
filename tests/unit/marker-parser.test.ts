import { describe, expect, it } from 'vitest';
import { extractActions, stripMarkersForDisplay } from '../../src/chat/markerParser';

describe('stripMarkersForDisplay', () => {
  it('removes a complete marker', () => {
    expect(stripMarkersForDisplay('Check out {{link:lexicon}} it is great')).toBe(
      'Check out  it is great',
    );
  });

  it('hides a trailing marker that has not closed yet', () => {
    expect(stripMarkersForDisplay('Want to see it? {{link:lex')).toBe('Want to see it? ');
  });

  it('reveals the text once the marker closes on a later call', () => {
    const partial = stripMarkersForDisplay('Sure {{nav:ap');
    expect(partial).toBe('Sure ');
    const full = stripMarkersForDisplay('Sure {{nav:apps}} go look');
    expect(full).toBe('Sure  go look');
  });

  it('leaves plain text untouched', () => {
    expect(stripMarkersForDisplay('Nothing special here.')).toBe('Nothing special here.');
  });

  it('handles multiple complete markers', () => {
    expect(stripMarkersForDisplay('{{link:lexicon}} and {{link:sprout}}')).toBe(' and ');
  });
});

describe('extractActions', () => {
  it('extracts a single link action and strips it from the text', () => {
    const { displayText, actions } = extractActions('Take a look {{link:lexicon}}');
    expect(displayText).toBe('Take a look');
    expect(actions).toEqual([{ kind: 'link', id: 'lexicon' }]);
  });

  it('extracts a nav action', () => {
    const { actions } = extractActions('Here you go {{nav:apps}}');
    expect(actions).toEqual([{ kind: 'nav', id: 'apps' }]);
  });

  it('caps at two actions and drops the rest', () => {
    const { actions } = extractActions('{{link:lexicon}} {{link:sprout}} {{link:whereitwent}}');
    expect(actions).toHaveLength(2);
    expect(actions).toEqual([
      { kind: 'link', id: 'lexicon' },
      { kind: 'link', id: 'sprout' },
    ]);
  });

  it('still strips a third marker from the display text even though it is dropped as an action', () => {
    const { displayText } = extractActions('{{link:lexicon}} {{link:sprout}} {{link:whereitwent}}');
    expect(displayText).not.toContain('{{');
  });

  it('returns no actions and the original text when there are no markers', () => {
    const { displayText, actions } = extractActions('Just a plain answer.');
    expect(displayText).toBe('Just a plain answer.');
    expect(actions).toEqual([]);
  });

  it('collapses extra whitespace left behind after stripping markers', () => {
    const { displayText } = extractActions('Look here:  {{link:lexicon}}  and here');
    expect(displayText).toBe('Look here: and here');
  });
});
