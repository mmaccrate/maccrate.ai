import { describe, expect, it } from 'vitest';
import { sameBaseModel, validateCartridgeManifest } from './manifest';

const base = {
  repository: 'owner/base-model',
  revision: '1234567890abcdef1234567890abcdef12345678',
  file: 'base-q4_k_m.gguf',
  sha256: 'a'.repeat(64),
};

const validManifest = {
  schemaVersion: 1,
  id: 'support-tone-v1',
  name: 'Support tone',
  version: '1.0.0',
  description: 'Fixture only',
  baseModel: base,
  adapter: {
    repository: 'owner/adapter',
    revision: 'abcdef1234567890abcdef1234567890abcdef12',
    file: 'adapter.gguf',
    sha256: 'b'.repeat(64),
    format: 'gguf-lora',
    recommendedScale: 0.85,
  },
  runtime: { minimumVersion: '0.1.0' },
  behavior: { systemPrompt: 'Answer directly.', temperature: 0.2 },
  license: { adapter: 'Apache-2.0', baseModel: 'Apache-2.0' },
};

describe('validateCartridgeManifest', () => {
  it('accepts a pinned and hashed v1 fixture', () => {
    const result = validateCartridgeManifest(validManifest, { loadedBaseModel: base });
    expect(result.ok).toBe(true);
  });

  it('rejects mutable revisions, invalid hashes, and scale outside bounds', () => {
    const result = validateCartridgeManifest({
      ...validManifest,
      baseModel: { ...base, revision: 'main', sha256: 'not-a-hash' },
      adapter: { ...validManifest.adapter, recommendedScale: 5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('baseModel.revision must be an immutable hexadecimal revision');
      expect(result.errors).toContain('baseModel.sha256 must be a 64-character hexadecimal hash');
      expect(result.errors).toContain('adapter.recommendedScale must be greater than 0 and at most 4');
    }
  });

  it('rejects duplicate IDs and a different loaded base model', () => {
    const result = validateCartridgeManifest(validManifest, {
      existingIds: new Set(['support-tone-v1']),
      loadedBaseModel: { ...base, revision: 'f'.repeat(40) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('duplicate cartridge id: support-tone-v1');
      expect(result.errors).toContain('cartridge base model does not match the loaded base model');
    }
  });
});

describe('sameBaseModel', () => {
  it('uses repository, immutable revision, and filename as identity', () => {
    expect(sameBaseModel(base, { ...base, sha256: 'c'.repeat(64) })).toBe(true);
    expect(sameBaseModel(base, { ...base, file: 'other.gguf' })).toBe(false);
  });
});
