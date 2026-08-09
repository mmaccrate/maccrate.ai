import { describe, expect, it } from 'vitest';
import { explicitLoraSelection, hashBlobForIntegrity, serializeQwen35NoThinking, WllamaCartridgeEngine } from './wllama-engine';

describe('Qwen3.5 runtime protocol', () => {
  it('uses the exact no-thinking training serialization and generation suffix', () => {
    expect(serializeQwen35NoThinking([
      { role: 'system', content: 'System contract.' },
      { role: 'user', content: 'Same prompt.' },
    ])).toBe(
      '<|im_start|>system\nSystem contract.<|im_end|>\n' +
      '<|im_start|>user\nSame prompt.<|im_end|>\n' +
      '<|im_start|>assistant\n<think>\n\n</think>\n\n',
    );
  });

  it('serializes prior assistant turns with Qwen role boundaries', () => {
    const prompt = serializeQwen35NoThinking([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
    ]);
    expect(prompt).toContain('<|im_start|>assistant\ntwo<|im_end|>\n<|im_start|>user\nthree<|im_end|>');
    expect(prompt.match(/<think>/g)).toHaveLength(1);
  });

  it('makes activation and deactivation explicit for native per-request LoRA selection', () => {
    expect(explicitLoraSelection({ index: 2, scale: 0.75 })).toEqual([{ id: 2, scale: 0.75 }]);
    expect(explicitLoraSelection(null, 0)).toEqual([{ id: 0, scale: 0 }]);
    expect(explicitLoraSelection(null)).toEqual([]);
  });

  it('hashes artifact blobs incrementally and reports completion', async () => {
    const progress: Array<[number, number]> = [];
    const blob = new Blob(['abc']);
    await expect(hashBlobForIntegrity(blob, (loaded, total) => progress.push([loaded, total])))
      .resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(progress.at(-1)).toEqual([3, 3]);
  });

  it('snapshots and restores cartridge-specific conversation state defensively', async () => {
    const runtime = new WllamaCartridgeEngine();
    const source = [{ role: 'user' as const, content: 'Keep this turn.' }];
    await runtime.replaceConversationState(source);
    source[0].content = 'mutated outside';
    const snapshot = runtime.getConversationState();
    expect(snapshot).toEqual([{ role: 'user', content: 'Keep this turn.' }]);
    snapshot[0].content = 'mutated snapshot';
    expect(runtime.getConversationState()).toEqual([{ role: 'user', content: 'Keep this turn.' }]);
    await runtime.clearConversationState();
    expect(runtime.getConversationState()).toEqual([]);
  });
});
