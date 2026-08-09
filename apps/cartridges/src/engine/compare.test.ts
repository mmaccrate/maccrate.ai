import { describe, expect, it, vi } from 'vitest';
import { runBaseAdapterComparison, runBaseAdapterDemoComparison, runBaseAdapterExperienceComparison } from './compare';
import type { LocalCartridgeEngine } from './types';

function mockEngine(failAdapted = false, initialAdapter: { id: string; scale: number } | null = null): LocalCartridgeEngine {
  let activeAdapter = initialAdapter;
  let conversation = [{ role: 'user' as const, content: 'existing context' }];
  return {
    getState: () => 'ready',
    clearConversationState: vi.fn(async () => undefined),
    deactivateAdapter: vi.fn(async () => { activeAdapter = null; }),
    activateAdapter: vi.fn(async (id: string, scale = 1) => { activeAdapter = { id, scale }; }),
    getActiveAdapter: vi.fn(() => activeAdapter),
    getConversationState: vi.fn(() => [...conversation]),
    replaceConversationState: vi.fn(async (messages) => { conversation = [...messages]; }),
    generate: vi.fn(async function* () {
      if (activeAdapter && failAdapted) throw new Error('adapter generation failed');
      yield { type: 'token', text: activeAdapter ? 'adapted answer' : 'base answer' } as const;
      yield { type: 'done' } as const;
    }),
    detectCapabilities: vi.fn(), loadBaseModel: vi.fn(), stopGeneration: vi.fn(), installAdapter: vi.fn(),
    unloadAdapter: vi.fn(), clearLocalArtifacts: vi.fn(), getLoadedModel: vi.fn(), subscribe: vi.fn(), dispose: vi.fn(),
  } as unknown as LocalCartridgeEngine;
}

describe('Compare Mode orchestration', () => {
  it('runs a complete multi-step experience in each mode and restores the active adapter', async () => {
    const engine = mockEngine(false, { id: 'stagehand', scale: 1 });
    const runExperience = vi.fn(async () => {
      let text = '';
      for await (const event of engine.generate({ prompt: 'extract', maxTokens: 32, temperature: 0 })) {
        if (event.type === 'token') text += event.text;
      }
      return `${text} + browser tool result`;
    });
    const result = await runBaseAdapterExperienceComparison(engine, 'stagehand', runExperience);
    expect(result).toEqual({
      base: 'base answer + browser tool result',
      adapted: 'adapted answer + browser tool result',
      previousModeRestored: true,
    });
    expect(runExperience).toHaveBeenCalledTimes(2);
    expect(engine.generate).toHaveBeenCalledTimes(2);
    expect(engine.activateAdapter).toHaveBeenLastCalledWith('stagehand', 1);
    expect(engine.replaceConversationState).toHaveBeenCalledWith([{ role: 'user', content: 'existing context' }]);
  });
  it('runs only Stock and adapter for the product demo and preserves the supplied decoding policy', async () => {
    const engine = mockEngine(false, { id: 'stagehand', scale: 1 });
    const result = await runBaseAdapterDemoComparison(engine, 'stagehand', {
      prompt: 'same prompt', maxTokens: 300, temperature: 0.55, topP: 0.9, seed: 77,
    });
    expect(result).toMatchObject({ base: { text: 'base answer' }, adapted: { text: 'adapted answer' }, previousModeRestored: true });
    expect(engine.generate).toHaveBeenCalledTimes(2);
    expect(engine.generate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.55, topP: 0.9, seed: 77 }));
    expect(engine.activateAdapter).toHaveBeenLastCalledWith('stagehand', 1);
  });

  it('runs deterministic Base A / Adapter / Base B and records real restoration evidence', async () => {
    const engine = mockEngine();
    const result = await runBaseAdapterComparison(engine, 'stagehand', { prompt: 'same prompt', maxTokens: 64, temperature: 0 });

    expect(result).toMatchObject({
      prompt: 'same prompt',
      base: { text: 'base answer' },
      baseBefore: { text: 'base answer' },
      adapted: { text: 'adapted answer' },
      baseAfter: { text: 'base answer' },
      restoredToBase: true,
      baseRestorationMatch: true,
      lifecycle: {
        previousMode: { mode: 'base' },
        finalMode: { mode: 'base' },
        previousModeRestored: true,
        sequence: [
          { phase: 'baseBefore', mode: 'base', completed: true },
          { phase: 'adapted', mode: 'adapter', adapterId: 'stagehand', scale: 1, completed: true },
          { phase: 'baseAfter', mode: 'base', completed: true },
        ],
      },
    });
    expect(engine.clearConversationState).toHaveBeenCalledTimes(4);
    expect(engine.deactivateAdapter).toHaveBeenCalledTimes(3);
    expect(engine.activateAdapter).toHaveBeenCalledWith('stagehand', 1);
    expect(engine.generate).toHaveBeenCalledTimes(3);
    expect(engine.generate).toHaveBeenCalledWith(expect.objectContaining({ seed: 42, cachePrompt: false }));
    expect(engine.replaceConversationState).toHaveBeenCalledWith([{ role: 'user', content: 'existing context' }]);
  });

  it('restores base mode even when adapted generation fails', async () => {
    const engine = mockEngine(true);
    await expect(runBaseAdapterComparison(engine, 'stagehand', { prompt: 'same', maxTokens: 64, temperature: 0 })).rejects.toThrow('adapter generation failed');
    expect(engine.deactivateAdapter).toHaveBeenCalledTimes(2);
    expect(engine.clearConversationState).toHaveBeenCalledTimes(3);
    expect(engine.getActiveAdapter()).toBeNull();
  });

  it('restores the adapter that was active before comparison', async () => {
    const engine = mockEngine(false, { id: 'previous', scale: 0.5 });
    const result = await runBaseAdapterComparison(engine, 'stagehand', { prompt: 'same', maxTokens: 64, temperature: 0 });
    expect(result.lifecycle).toMatchObject({
      previousMode: { mode: 'adapter', id: 'previous', scale: 0.5 },
      finalMode: { mode: 'adapter', id: 'previous', scale: 0.5 },
      previousModeRestored: true,
    });
    expect(engine.activateAdapter).toHaveBeenLastCalledWith('previous', 0.5);
  });

  it('still attempts mode restoration when cleanup state clearing fails', async () => {
    const engine = mockEngine(false, { id: 'previous', scale: 0.5 });
    vi.mocked(engine.clearConversationState).mockRejectedValueOnce(new Error('initial clear failed'));
    await expect(runBaseAdapterComparison(engine, 'stagehand', { prompt: 'same', maxTokens: 64, temperature: 0 }))
      .rejects.toThrow('initial clear failed');
    expect(engine.activateAdapter).toHaveBeenCalledWith('previous', 0.5);
  });

  it('rejects non-deterministic requests before changing engine mode', async () => {
    const engine = mockEngine();
    await expect(runBaseAdapterComparison(engine, 'stagehand', { prompt: 'same', maxTokens: 64, temperature: 0.7 }))
      .rejects.toThrow('temperature 0');
    expect(engine.deactivateAdapter).not.toHaveBeenCalled();
  });
});
