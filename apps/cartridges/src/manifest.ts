import type { BaseModelIdentity } from './engine/types';

export interface CartridgeManifestV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description: string;
  baseModel: BaseModelIdentity & { sha256: string };
  adapter: {
    repository: string;
    revision: string;
    file: string;
    sha256: string;
    byteSize?: number;
    /** Optional production source. Omit for user-selected GGUFs. */
    url?: string;
    format: 'gguf-lora';
    recommendedScale: number;
  };
  runtime: { minimumVersion: string };
  behavior: { systemPrompt: string; temperature: number };
  license: { adapter: string; baseModel: string };
}

export interface ManifestValidationOptions {
  existingIds?: ReadonlySet<string>;
  loadedBaseModel?: BaseModelIdentity;
}

export type ManifestValidationResult =
  | { ok: true; value: CartridgeManifestV1 }
  | { ok: false; errors: string[] };

const sha256Pattern = /^[a-f0-9]{64}$/i;
const revisionPattern = /^[a-f0-9]{12,64}$/i;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: unknown, path: string, errors: string[]): string {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${path} must be a non-empty string`);
    return '';
  }
  return value;
}

export function sameBaseModel(a: BaseModelIdentity, b: BaseModelIdentity): boolean {
  return a.repository === b.repository && a.revision === b.revision && a.file === b.file;
}

export function validateCartridgeManifest(
  input: unknown,
  options: ManifestValidationOptions = {},
): ManifestValidationResult {
  const errors: string[] = [];
  const root = record(input);
  if (!root) return { ok: false, errors: ['manifest must be an object'] };

  if (root.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const id = requiredString(root.id, 'id', errors);
  const name = requiredString(root.name, 'name', errors);
  const version = requiredString(root.version, 'version', errors);
  const description = requiredString(root.description, 'description', errors);
  if (version && !semverPattern.test(version)) errors.push('version must be semantic versioning');
  if (id && options.existingIds?.has(id)) errors.push(`duplicate cartridge id: ${id}`);

  const base = record(root.baseModel);
  const adapter = record(root.adapter);
  const runtime = record(root.runtime);
  const behavior = record(root.behavior);
  const license = record(root.license);
  if (!base) errors.push('baseModel must be an object');
  if (!adapter) errors.push('adapter must be an object');
  if (!runtime) errors.push('runtime must be an object');
  if (!behavior) errors.push('behavior must be an object');
  if (!license) errors.push('license must be an object');

  const baseModel = {
    repository: requiredString(base?.repository, 'baseModel.repository', errors),
    revision: requiredString(base?.revision, 'baseModel.revision', errors),
    file: requiredString(base?.file, 'baseModel.file', errors),
    sha256: requiredString(base?.sha256, 'baseModel.sha256', errors),
  };
  if (baseModel.revision && !revisionPattern.test(baseModel.revision)) {
    errors.push('baseModel.revision must be an immutable hexadecimal revision');
  }
  if (baseModel.sha256 && !sha256Pattern.test(baseModel.sha256)) {
    errors.push('baseModel.sha256 must be a 64-character hexadecimal hash');
  }

  const adapterRevision = requiredString(adapter?.revision, 'adapter.revision', errors);
  const adapterHash = requiredString(adapter?.sha256, 'adapter.sha256', errors);
  const adapterFormat = adapter?.format;
  const recommendedScale = adapter?.recommendedScale;
  const adapterByteSize = adapter?.byteSize;
  if (adapterRevision && !revisionPattern.test(adapterRevision)) {
    errors.push('adapter.revision must be an immutable hexadecimal revision');
  }
  if (adapterHash && !sha256Pattern.test(adapterHash)) {
    errors.push('adapter.sha256 must be a 64-character hexadecimal hash');
  }
  if (adapterFormat !== 'gguf-lora') errors.push('adapter.format must be gguf-lora');
  if (typeof recommendedScale !== 'number' || recommendedScale <= 0 || recommendedScale > 4) {
    errors.push('adapter.recommendedScale must be greater than 0 and at most 4');
  }
  if (adapterByteSize !== undefined && (!Number.isSafeInteger(adapterByteSize) || (adapterByteSize as number) <= 0)) {
    errors.push('adapter.byteSize must be a positive safe integer');
  }
  if (adapter?.url !== undefined && (typeof adapter.url !== 'string' || !/^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[a-f0-9]{12,64}\//.test(adapter.url))) {
    errors.push('adapter.url must be an immutable Hugging Face resolve URL');
  }

  const minimumVersion = requiredString(runtime?.minimumVersion, 'runtime.minimumVersion', errors);
  if (minimumVersion && !semverPattern.test(minimumVersion)) {
    errors.push('runtime.minimumVersion must be semantic versioning');
  }
  const temperature = behavior?.temperature;
  if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
    errors.push('behavior.temperature must be between 0 and 2');
  }
  requiredString(behavior?.systemPrompt, 'behavior.systemPrompt', errors);
  requiredString(license?.adapter, 'license.adapter', errors);
  requiredString(license?.baseModel, 'license.baseModel', errors);
  requiredString(adapter?.repository, 'adapter.repository', errors);
  requiredString(adapter?.file, 'adapter.file', errors);

  if (options.loadedBaseModel && !sameBaseModel(baseModel, options.loadedBaseModel)) {
    errors.push('cartridge base model does not match the loaded base model');
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: input as CartridgeManifestV1 };
}
