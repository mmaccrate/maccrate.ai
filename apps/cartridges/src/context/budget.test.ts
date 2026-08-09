import { describe, expect, it } from 'vitest';
import { composeContext, estimateTokens } from './budget';

describe('context budget', () => {
  it('uses a conservative UTF-8 estimate', () => {
    expect(estimateTokens('abcdef')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });

  it('keeps required compact state and drops optional history', () => {
    const result = composeContext([
      { id: 'instruction', text: 'Follow supplied legal IDs.', required: true },
      { id: 'state', text: 'turn=2 boss=99', required: true },
      { id: 'old-history', text: 'x'.repeat(300) },
    ], { maxInputTokens: 25, maxOutputTokens: 10 });
    expect(result.included).toEqual(['instruction', 'state']);
    expect(result.dropped).toEqual(['old-history']);
    expect(result.estimatedInputTokens).toBeLessThanOrEqual(25);
  });

  it('fails instead of silently dropping required state', () => {
    expect(() => composeContext([{ id: 'state', text: 'x'.repeat(100), required: true }], { maxInputTokens: 5, maxOutputTokens: 5 })).toThrow(/state/);
  });
});
