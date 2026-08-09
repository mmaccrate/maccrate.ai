import { describe, expect, it } from 'vitest';
import {
  RELEASE_BASE_MODEL,
  RELEASE_CARTRIDGE_MANIFESTS,
  adapterArtifactFromManifest,
} from './config';
import { validateCartridgeManifest } from './manifest';

describe('Qwen3.5 release artifact registry', () => {
  it('pins one real Qwen3.5 Q4_K_M base and no development model', () => {
    expect(RELEASE_BASE_MODEL).toMatchObject({
      id: 'qwen3.5-2b-q4km',
      file: 'Qwen3.5-2B-Q4_K_M.gguf',
      sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
      byteSize: 1280835840,
      mode: 'qwen3.5-chat',
    });
    expect(RELEASE_BASE_MODEL).not.toHaveProperty('developmentOnly');
    expect(RELEASE_BASE_MODEL.url).toBe('/models/base/Qwen3.5-2B-Q4_K_M.gguf');
  });

  it('registers only physically present converted adapters against exactly that base', () => {
    expect(RELEASE_CARTRIDGE_MANIFESTS.map(({ id }) => id)).toEqual(['weather-radio', 'stagehand']);
    for (const manifest of RELEASE_CARTRIDGE_MANIFESTS) {
      expect(validateCartridgeManifest(manifest, { loadedBaseModel: RELEASE_BASE_MODEL })).toEqual({ ok: true, value: manifest });
      expect(manifest.adapter.url).toMatch(/^https:\/\/huggingface\.co\/mmaccrate\/model-cartidges\/resolve\/[a-f0-9]{40}\//);
      expect(manifest.adapter.file).toMatch(/qwen3\.5-2b-lora-f16\.gguf$/);
      expect(manifest.adapter.byteSize).toBeGreaterThan(1_000_000);
    }
    expect(new Set(RELEASE_CARTRIDGE_MANIFESTS.map(({ adapter }) => adapter.sha256)).size).toBe(2);
  });

  it('lets a selected File replace the production URL without changing identity', () => {
    const manifest = RELEASE_CARTRIDGE_MANIFESTS[0];
    const file = new File(['fixture'], manifest.adapter.file);
    const local = adapterArtifactFromManifest(manifest, file);
    expect(local.file).toBe(file);
    expect(local.url).toBeUndefined();
    expect(local.sha256).toBe(manifest.adapter.sha256);
  });
});
