import type { AdapterArtifact, BaseModelArtifact } from './engine/types';
import type { CartridgeManifestV1 } from './manifest';
import { STAGEHAND_SYSTEM_PROMPT } from './stagehand/contract';

export const APP_NAME = 'Model Cartridges';
export const WLLAMA_VERSION = '3.5.1';
const assetPath = (path: string): string => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
export const WLLAMA_WASM_PATH = assetPath('wasm/wllama.wasm');
export const PRODUCTION_MODEL_ROOT = assetPath('models');
export const HUGGINGFACE_ADAPTER_REPOSITORY = 'mmaccrate/model-cartidges';
export const HUGGINGFACE_ADAPTER_REVISION = 'e7c83d7d8f3a657a89f46b625e4de84f777fb157';
const HUGGINGFACE_ADAPTER_ROOT = `https://huggingface.co/${HUGGINGFACE_ADAPTER_REPOSITORY}/resolve/${HUGGINGFACE_ADAPTER_REVISION}`;

/** The single base shared by the Base Console and every release adapter. */
export const RELEASE_BASE_MODEL: BaseModelArtifact = {
  id: 'qwen3.5-2b-q4km',
  name: 'Qwen3.5 2B Q4_K_M',
  repository: 'unsloth/Qwen3.5-2B-GGUF',
  revision: 'f6d5376be1edb4d416d56da11e5397a961aca8ae',
  file: 'Qwen3.5-2B-Q4_K_M.gguf',
  sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
  byteSize: 1280835840,
  url: `${PRODUCTION_MODEL_ROOT}/base/Qwen3.5-2B-Q4_K_M.gguf`,
  mode: 'qwen3.5-chat',
  contextSize: 4096,
};

const baseModel = {
  repository: RELEASE_BASE_MODEL.repository,
  revision: RELEASE_BASE_MODEL.revision,
  file: RELEASE_BASE_MODEL.file,
  sha256: RELEASE_BASE_MODEL.sha256!,
};

const release = (
  id: 'weather-radio' | 'stagehand',
  name: string,
  description: string,
  sha256: string,
  byteSize: number,
  systemPrompt: string,
): CartridgeManifestV1 => ({
  schemaVersion: 1,
  id,
  name,
  version: '0.1.0',
  description,
  baseModel,
  adapter: {
    repository: HUGGINGFACE_ADAPTER_REPOSITORY,
    revision: HUGGINGFACE_ADAPTER_REVISION,
    file: `${id}-qwen3.5-2b-lora-f16.gguf`,
    sha256,
    byteSize,
    format: 'gguf-lora',
    recommendedScale: 1,
    url: `${HUGGINGFACE_ADAPTER_ROOT}/${id}-qwen3.5-2b-lora-f16.gguf`,
  },
  runtime: { minimumVersion: '0.1.0' },
  behavior: { systemPrompt, temperature: 0 },
  license: { adapter: 'local-release-artifact', baseModel: 'Apache-2.0' },
});

/** Only artifacts that are physically present and hash-pinned are loadable. */
export const RELEASE_CARTRIDGE_MANIFESTS = [
  release('weather-radio', 'Weather Radio', 'Produces bounded requests and grounded weather summaries.', '298ab07a6c2290cff4a76c13d9a86458555905b4d6f78899b1497c495530d01e', 21837344, 'Emit only the validated tool-request schema before data. Never state current weather until normalized tool data is supplied.'),
  release('stagehand', 'Stagehand', 'Edits one authored broadcast scene through a strict finite action contract.', '48a119cc24b30fcd5120c2c4b2322a06ee77a9d614012b462b1b8ff9bcbee0f2', 16845376, STAGEHAND_SYSTEM_PROMPT),
] as const;

export const RELEASE_MANIFEST_BY_ID = new Map(RELEASE_CARTRIDGE_MANIFESTS.map((manifest) => [manifest.id, manifest]));

export function adapterArtifactFromManifest(manifest: CartridgeManifestV1, file?: File): AdapterArtifact {
  return {
    id: manifest.id,
    name: manifest.name,
    baseModel: manifest.baseModel,
    file,
    url: file ? undefined : manifest.adapter.url,
    sha256: manifest.adapter.sha256,
    byteSize: manifest.adapter.byteSize,
    format: manifest.adapter.format,
    recommendedScale: manifest.adapter.recommendedScale,
  };
}

export const LOCAL_PROTOTYPE_MODEL = RELEASE_BASE_MODEL;
export const DEMO_CARTRIDGE = RELEASE_CARTRIDGE_MANIFESTS[0];
