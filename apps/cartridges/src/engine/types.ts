export type EngineState =
  | 'unsupported'
  | 'idle'
  | 'downloading-model'
  | 'loading-model'
  | 'ready'
  | 'generating'
  | 'stopping'
  | 'loading-adapter'
  | 'switching-adapter'
  | 'failed'
  | 'disposed';

export interface CapabilityReport {
  webGPU: boolean;
  crossOriginIsolated: boolean;
  sharedArrayBuffer: boolean;
  opfs: boolean;
  compatibility: 'compatible' | 'partial' | 'unsupported';
  blockers: string[];
}

export interface BaseModelIdentity {
  repository: string;
  revision: string;
  file: string;
  sha256?: string;
}

export interface BaseModelArtifact extends BaseModelIdentity {
  id: string;
  name: string;
  url: string;
  mode: 'raw-completion' | 'chat' | 'qwen3.5-chat';
  byteSize?: number;
  developmentOnly?: boolean;
  contextSize: number;
}

export interface AdapterArtifact {
  id: string;
  name: string;
  baseModel: BaseModelIdentity;
  file?: File;
  blob?: Blob;
  url?: string;
  sha256: string;
  byteSize?: number;
  format: 'gguf-lora';
  recommendedScale: number;
}

export interface GenerationRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens: number;
  temperature: number;
  topP?: number;
  isolated?: boolean;
  seed?: number;
  cachePrompt?: boolean;
  grammar?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ActiveAdapterSelection {
  id: string;
  scale: number;
}

export type GenerationEvent =
  | { type: 'token'; text: string }
  | { type: 'metrics'; timeToFirstTokenMs: number | null; tokensPerSecond: number | null; totalDurationMs: number }
  | { type: 'done' };

export type EngineEvent =
  | { type: 'state'; state: EngineState }
  | { type: 'progress'; loaded: number; total: number; percent: number | null; phase?: 'adapter' | 'hashing-adapter' | 'model' | 'hashing-model' }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string };

export type EngineErrorCode =
  | 'unsupported-browser'
  | 'invalid-state'
  | 'download-failed'
  | 'hash-mismatch'
  | 'model-load-failed'
  | 'generation-failed'
  | 'generation-cancelled'
  | 'adapter-unsupported'
  | 'adapter-mismatch'
  | 'worker-failed'
  | 'disposed';

export class CartridgeEngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'CartridgeEngineError';
  }
}

export interface LocalCartridgeEngine {
  detectCapabilities(): Promise<CapabilityReport>;
  loadBaseModel(model: BaseModelArtifact): Promise<void>;
  generate(request: GenerationRequest): AsyncIterable<GenerationEvent>;
  stopGeneration(): Promise<void>;
  clearConversationState(): Promise<void>;
  getConversationState(): ConversationMessage[];
  replaceConversationState(messages: readonly ConversationMessage[]): Promise<void>;
  installAdapter(adapter: AdapterArtifact): Promise<void>;
  activateAdapter(adapterId: string, scale?: number): Promise<void>;
  deactivateAdapter(): Promise<void>;
  getActiveAdapter(): ActiveAdapterSelection | null;
  unloadAdapter(adapterId: string): Promise<void>;
  clearLocalArtifacts(): Promise<void>;
  getState(): EngineState;
  getLoadedModel(): BaseModelArtifact | null;
  subscribe(listener: (event: EngineEvent) => void): () => void;
  dispose(): Promise<void>;
}
