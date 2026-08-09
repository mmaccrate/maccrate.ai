import { describe, expect, it } from 'vitest';
import { CARTRIDGE_BY_ID, RELEASE_CARTRIDGES } from './registry';

describe('release cartridge registry', () => {
  it('contains the exact three active shelf identities once', () => {
    expect(RELEASE_CARTRIDGES.map(({ id }) => id)).toEqual(['stock', 'weather-radio', 'stagehand']);
    expect(new Set(RELEASE_CARTRIDGES.map(({ id }) => id)).size).toBe(3);
  });

  it('marks both adapters as locally verified release candidates', () => {
    expect(CARTRIDGE_BY_ID.get('stagehand')).toMatchObject({ status: 'release-candidate', adapterManifest: '.local-artifacts/manifests/stagehand.json' });
    expect(CARTRIDGE_BY_ID.get('weather-radio')?.status).toBe('release-candidate');
  });

  it('provides guidance and bounded context for every cartridge', () => {
    for (const cartridge of RELEASE_CARTRIDGES) {
      expect(cartridge.starterActions.length).toBeGreaterThan(0);
      expect(cartridge.starterActions.some(({ recommended }) => recommended)).toBe(true);
      expect(cartridge.contextBudget.maxInputTokens).toBeLessThanOrEqual(1500);
      expect(cartridge.contextBudget.maxContextTokens).toBeLessThanOrEqual(4096);
    }
  });

  it('pins every cartridge to the game-selected shared base', () => {
    expect(new Set(RELEASE_CARTRIDGES.map(({ baseModelId }) => baseModelId))).toEqual(new Set(['qwen3.5-2b-q4km']));
  });
});
