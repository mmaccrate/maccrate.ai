import { Wllama, WllamaAbortError, WllamaError } from '@wllama/wllama';
import { createSHA256 } from 'hash-wasm';
import { WLLAMA_WASM_PATH } from '../config';
import { EngineStateMachine } from './state-machine';
import {
  CartridgeEngineError,
  type AdapterArtifact,
  type BaseModelArtifact,
  type CapabilityReport,
  type ConversationMessage,
  type EngineEvent,
  type EngineState,
  type GenerationEvent,
  type GenerationRequest,
  type LocalCartridgeEngine,
} from './types';

const textEncoder = new TextEncoder();

export type Qwen35Message = { role: 'system' | 'user' | 'assistant'; content: string };
type StoredMessage = ConversationMessage;

const QWEN35_GENERATION_SUFFIX = '<|im_start|>assistant\n<think>\n\n</think>\n\n';

/** Exact Qwen3.5 enable_thinking=false serialization used during training. */
export function serializeQwen35NoThinking(messages: readonly Qwen35Message[]): string {
  return messages.map(({ role, content }) => `<|im_start|>${role}\n${content}<|im_end|>\n`).join('') + QWEN35_GENERATION_SUFFIX;
}

/** Base mode is explicit scale zero once any adapter has been loaded. */
export function explicitLoraSelection(
  active: { index: number; scale: number } | null,
  firstInstalledIndex?: number,
): Array<{ id: number; scale: number }> {
  if (active) return [{ id: active.index, scale: active.scale }];
  return firstInstalledIndex === undefined ? [] : [{ id: firstInstalledIndex, scale: 0 }];
}

export async function hashBlobForIntegrity(blob: Blob, onProgress?: (loaded: number, total: number) => void): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();
  const reader = blob.stream().getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hasher.update(value);
    loaded += value.byteLength;
    onProgress?.(loaded, blob.size);
  }
  return hasher.digest('hex');
}

export class WllamaCartridgeEngine implements LocalCartridgeEngine {
  private readonly machine = new EngineStateMachine();
  private readonly listeners = new Set<(event: EngineEvent) => void>();
  private readonly adapters = new Map<string, { artifact: AdapterArtifact; blob: Blob; index: number }>();
  private runtime: Wllama | null = null;
  private model: BaseModelArtifact | null = null;
  private messages: StoredMessage[] = [];
  private abortController: AbortController | null = null;
  private activeAdapter: { id: string; index: number; scale: number } | null = null;

  private requestLoraSelection(): Array<{ id: number; scale: number }> {
    if (this.activeAdapter) return explicitLoraSelection(this.activeAdapter);
    const staged = this.adapters.values().next().value;
    return explicitLoraSelection(null, staged?.index);
  }

  getState(): EngineState {
    return this.machine.current;
  }

  getLoadedModel(): BaseModelArtifact | null {
    return this.model;
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: EngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private transition(next: EngineState): void {
    this.machine.transition(next);
    this.emit({ type: 'state', state: next });
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    this.emit({ type: 'log', level, message });
  }

  private async downloadBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) throw new CartridgeEngineError('download-failed', `Adapter download failed: HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.body) return response.blob();
    const reader = response.body.getReader();
    const chunks: ArrayBuffer[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const copy = new Uint8Array(value.byteLength);
        copy.set(value);
        chunks.push(copy.buffer);
        loaded += value.byteLength;
        this.emit({ type: 'progress', loaded, total, percent: total ? Math.round((loaded / total) * 100) : null, phase: 'adapter' });
      }
    }
    return new Blob(chunks, { type: 'application/octet-stream' });
  }

  async detectCapabilities(): Promise<CapabilityReport> {
    const webGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const isolated = typeof globalThis.crossOriginIsolated === 'boolean' && globalThis.crossOriginIsolated;
    const sharedArrayBuffer = typeof globalThis.SharedArrayBuffer !== 'undefined';
    const opfs = typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
    const blockers: string[] = [];

    if (!webGPU) blockers.push('WebGPU is unavailable. Use a current desktop Chromium browser with WebGPU enabled.');
    if (!isolated) blockers.push('Cross-origin isolation is disabled. Serve COOP and COEP headers for multithreaded WASM.');
    if (!sharedArrayBuffer) blockers.push('SharedArrayBuffer is unavailable. Cross-origin isolation is required.');

    const compatibility = !webGPU
      ? 'unsupported'
      : isolated && sharedArrayBuffer
        ? 'compatible'
        : 'partial';

    if (this.machine.current === 'idle' && compatibility === 'unsupported') this.transition('unsupported');
    if (this.machine.current === 'unsupported' && compatibility !== 'unsupported') this.transition('idle');

    return { webGPU, crossOriginIsolated: isolated, sharedArrayBuffer, opfs, compatibility, blockers };
  }

  async loadBaseModel(model: BaseModelArtifact): Promise<void> {
    if (this.machine.current === 'disposed') throw new CartridgeEngineError('disposed', 'Engine is disposed.');
    if (!['idle', 'failed'].includes(this.machine.current)) {
      throw new CartridgeEngineError('invalid-state', `Cannot load a model while engine is ${this.machine.current}.`);
    }

    const capabilities = await this.detectCapabilities();
    if (!capabilities.webGPU) {
      throw new CartridgeEngineError('unsupported-browser', 'WebGPU is required; no server fallback is provided.');
    }

    for (const { artifact } of this.adapters.values()) {
      const base = artifact.baseModel;
      const mismatch = base.repository !== model.repository || base.revision !== model.revision || base.file !== model.file ||
        Boolean(base.sha256 && model.sha256 && base.sha256.toLowerCase() !== model.sha256.toLowerCase());
      if (mismatch) throw new CartridgeEngineError('adapter-mismatch', `${artifact.name} does not target ${model.name}.`);
    }

    if (this.runtime) await this.runtime.exit();
    this.runtime = new Wllama(
      { default: WLLAMA_WASM_PATH },
      {
        suppressNativeLog: true,
        logger: {
          debug: (...args: unknown[]) => this.log('info', args.map(String).join(' ')),
          log: (...args: unknown[]) => this.log('info', args.map(String).join(' ')),
          warn: (...args: unknown[]) => this.log('warn', args.map(String).join(' ')),
          error: (...args: unknown[]) => this.log('error', args.map(String).join(' ')),
        },
      },
    );
    this.runtime.setCompat(null);

    try {
      this.transition('downloading-model');
      const cachedModel = await this.runtime.modelManager.getModelOrDownload(
        { url: model.url },
        {
          progressCallback: ({ loaded, total }) => {
            this.emit({
              type: 'progress',
              loaded,
              total,
              percent: total > 0 ? Math.round((loaded / total) * 100) : null,
              phase: 'model',
            });
          },
        },
      );
      const blobs = await cachedModel.open();
      if (model.sha256) {
        this.emit({ type: 'progress', loaded: 0, total: 0, percent: null, phase: 'hashing-model' });
        if (blobs.length !== 1 || !blobs[0]) {
          throw new CartridgeEngineError('hash-mismatch', 'Hash verification currently requires a single-file GGUF.');
        }
        const actualHash = await hashBlobForIntegrity(blobs[0], (loaded, total) => {
          this.emit({ type: 'progress', loaded, total, percent: Math.round((loaded / total) * 100), phase: 'hashing-model' });
        });
        if (actualHash !== model.sha256.toLowerCase()) {
          await cachedModel.remove();
          throw new CartridgeEngineError(
            'hash-mismatch',
            `Downloaded GGUF hash mismatch. Expected ${model.sha256}, received ${actualHash}.`,
          );
        }
      }

      this.transition('loading-model');
      await this.runtime.loadModel(blobs, {
        n_ctx: model.contextSize,
        n_batch: Math.min(model.contextSize, 512),
        n_gpu_layers: 99999,
        flash_attn: true,
        lora_adapters: [...this.adapters.values()].map(({ blob }) => ({ blob, scale: 1 })),
        lora_init_without_apply: true,
      });
      this.model = model;
      this.messages = [];
      this.transition('ready');
      this.log('info', `Loaded ${model.name} with WebGPU requested for all layers.`);
    } catch (error) {
      if (this.machine.canTransition('failed')) this.transition('failed');
      if (error instanceof CartridgeEngineError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new CartridgeEngineError('model-load-failed', `Model loading failed: ${message}`, { cause: error });
    }
  }

  async *generate(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    if (this.machine.current !== 'ready' || !this.runtime || !this.model) {
      throw new CartridgeEngineError('invalid-state', `Generation requires ready state, not ${this.machine.current}.`);
    }
    if (!request.prompt.trim()) throw new CartridgeEngineError('generation-failed', 'Prompt cannot be empty.');

    this.transition('generating');
    this.abortController = new AbortController();
    const started = performance.now();
    let firstTokenAt: number | null = null;
    let output = '';
    let reportedTokens: number | null = null;

    try {
      const stream: AsyncIterable<any> = this.model.mode === 'chat'
        ? await this.runtime.createChatCompletion({
            messages: [...(request.isolated ? [] : this.messages), { role: 'user', content: request.prompt }],
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            top_p: request.topP,
            grammar: request.grammar,
            stream: true as const,
            abortSignal: this.abortController.signal,
            lora: this.requestLoraSelection(),
          })
        : await this.runtime.createCompletion({
            prompt: this.model.mode === 'qwen3.5-chat'
              ? serializeQwen35NoThinking([
                  ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
                  ...(request.isolated ? [] : this.messages),
                  { role: 'user', content: request.prompt },
                ])
              : request.prompt,
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            top_p: request.topP,
            grammar: request.grammar,
            seed: request.seed ?? 42,
            cache_prompt: request.cachePrompt ?? false,
            top_k: request.temperature === 0 ? 1 : undefined,
            stop: this.model.mode === 'qwen3.5-chat' ? ['<|im_end|>'] : undefined,
            stream: true as const,
            abortSignal: this.abortController.signal,
            lora: this.requestLoraSelection(),
          });

      for await (const chunk of stream) {
        const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
        const text = choice
          ? ('delta' in choice ? choice.delta?.content ?? '' : choice.text ?? '')
          : '';
        const usage = 'usage' in chunk ? chunk.usage : undefined;
        if (usage?.completion_tokens != null) reportedTokens = usage.completion_tokens;
        if (text) {
          if (firstTokenAt === null) firstTokenAt = performance.now();
          output += text;
          yield { type: 'token', text };
        }
      }

      if (!request.isolated && (this.model.mode === 'chat' || this.model.mode === 'qwen3.5-chat')) {
        this.messages.push({ role: 'user', content: request.prompt }, { role: 'assistant', content: output });
      }
      const finished = performance.now();
      const generationSeconds = firstTokenAt === null ? 0 : (finished - firstTokenAt) / 1000;
      yield {
        type: 'metrics',
        timeToFirstTokenMs: firstTokenAt === null ? null : firstTokenAt - started,
        tokensPerSecond: reportedTokens !== null && generationSeconds > 0 ? reportedTokens / generationSeconds : null,
        totalDurationMs: finished - started,
      };
      yield { type: 'done' };
      this.transition('ready');
    } catch (error) {
      if (error instanceof WllamaAbortError || this.abortController.signal.aborted) {
        if (this.getState() === 'stopping') this.transition('ready');
        throw new CartridgeEngineError('generation-cancelled', 'Generation was stopped.', { cause: error });
      }
      // Generation errors do not unload the model or adapters. Return to a
      // usable state so the user can revise the prompt or retry.
      this.transition('ready');
      const message = error instanceof WllamaError || error instanceof Error ? error.message : String(error);
      throw new CartridgeEngineError('generation-failed', `Generation failed: ${message}`, { cause: error });
    } finally {
      this.abortController = null;
    }
  }

  async stopGeneration(): Promise<void> {
    if (this.machine.current !== 'generating' || !this.abortController) return;
    this.transition('stopping');
    this.abortController.abort();
  }

  async clearConversationState(): Promise<void> {
    if (['generating', 'stopping'].includes(this.machine.current)) {
      throw new CartridgeEngineError('invalid-state', 'Stop generation before clearing conversation state.');
    }
    this.messages = [];
    this.log('info', 'Conversation state cleared. Prompts are never persisted.');
  }

  getConversationState(): ConversationMessage[] {
    return this.messages.map((message) => ({ ...message }));
  }

  async replaceConversationState(messages: readonly ConversationMessage[]): Promise<void> {
    if (['generating', 'stopping'].includes(this.machine.current)) {
      throw new CartridgeEngineError('invalid-state', 'Stop generation before changing conversation state.');
    }
    this.messages = messages.map((message) => ({ role: message.role, content: message.content }));
    this.log('info', `Restored ${this.messages.length} local conversation messages for the active cartridge.`);
  }

  async installAdapter(adapter: AdapterArtifact): Promise<void> {
    if (!['idle', 'failed'].includes(this.machine.current)) {
      throw new CartridgeEngineError(
        'invalid-state',
        'Stage adapters before loading the base model. Switching never reloads the base model.',
      );
    }
    const blob = adapter.file ?? adapter.blob ?? (adapter.url ? await this.downloadBlob(adapter.url) : null);
    if (!blob) throw new CartridgeEngineError('adapter-unsupported', 'Adapter requires a local file, Blob, or immutable URL.');
    this.emit({ type: 'progress', loaded: blob.size, total: blob.size, percent: null, phase: 'hashing-adapter' });
    const actualHash = await hashBlobForIntegrity(blob, (loaded, total) => {
      this.emit({ type: 'progress', loaded, total, percent: Math.round((loaded / total) * 100), phase: 'hashing-adapter' });
    });
    if (actualHash !== adapter.sha256.toLowerCase()) {
      throw new CartridgeEngineError('hash-mismatch', `Adapter hash mismatch. Received ${actualHash}.`);
    }
    const index = this.adapters.get(adapter.id)?.index ?? this.adapters.size;
    this.adapters.set(adapter.id, { artifact: adapter, blob, index });
    this.log('info', `Validated and staged adapter ${adapter.name} at runtime index ${index}.`);
  }

  async activateAdapter(adapterId: string, scale = 1): Promise<void> {
    if (this.machine.current !== 'ready') throw new CartridgeEngineError('invalid-state', 'Adapter switching requires a ready model.');
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new CartridgeEngineError('adapter-unsupported', 'Adapter is not staged.');
    if (scale <= 0 || scale > 4) throw new CartridgeEngineError('adapter-unsupported', 'Adapter scale must be greater than 0 and at most 4.');
    this.transition('switching-adapter');
    this.activeAdapter = { id: adapterId, index: adapter.index, scale };
    this.messages = [];
    this.transition('ready');
    this.log('info', `Activated ${adapter.artifact.name} at scale ${scale}. Conversation state cleared.`);
  }

  getActiveAdapter(): { id: string; scale: number } | null {
    return this.activeAdapter ? { id: this.activeAdapter.id, scale: this.activeAdapter.scale } : null;
  }

  async deactivateAdapter(): Promise<void> {
    if (this.machine.current !== 'ready') throw new CartridgeEngineError('invalid-state', 'Returning to base requires a ready model.');
    this.transition('switching-adapter');
    this.activeAdapter = null;
    this.messages = [];
    this.transition('ready');
    this.log('info', 'Returned to base-model weights. Conversation state cleared.');
  }

  async unloadAdapter(adapterId: string): Promise<void> {
    if (this.model) throw new CartridgeEngineError('invalid-state', 'Adapter memory is released when the runtime exits.');
    this.adapters.delete(adapterId);
  }

  async clearLocalArtifacts(): Promise<void> {
    if (['generating', 'stopping'].includes(this.machine.current)) await this.stopGeneration();
    await this.runtime?.modelManager.clear();
    this.log('info', 'Cached model artifacts cleared. No prompt history was stored.');
  }

  async dispose(): Promise<void> {
    this.abortController?.abort();
    await this.runtime?.exit();
    this.runtime = null;
    this.model = null;
    this.messages = [];
    this.adapters.clear();
    this.activeAdapter = null;
    if (this.machine.current !== 'disposed') this.transition('disposed');
  }
}

export const hashTextForDiagnostics = async (text: string): Promise<string> =>
  crypto.subtle.digest('SHA-256', textEncoder.encode(text)).then((bytes) =>
    [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
  );
