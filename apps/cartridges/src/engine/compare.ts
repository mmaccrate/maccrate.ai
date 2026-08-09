import type { ActiveAdapterSelection, GenerationEvent, GenerationRequest, LocalCartridgeEngine } from './types';

type GenerationOutput = { text: string; metrics: Extract<GenerationEvent, { type: 'metrics' }> | null };

type EngineMode = { mode: 'base' } | ({ mode: 'adapter' } & ActiveAdapterSelection);

export interface ComparisonLifecycleEvidence {
  previousMode: EngineMode;
  sequence: Array<
    | { phase: 'baseBefore'; mode: 'base'; completed: true }
    | { phase: 'adapted'; mode: 'adapter'; adapterId: string; scale: number; completed: true }
    | { phase: 'baseAfter'; mode: 'base'; completed: true }
  >;
  finalMode: EngineMode;
  previousModeRestored: true;
}

export interface ComparisonResult {
  prompt: string;
  /** @deprecated Use baseBefore. Retained for interface compatibility. */
  base: GenerationOutput;
  baseBefore: GenerationOutput;
  adapted: GenerationOutput;
  baseAfter: GenerationOutput;
  restoredToBase: boolean;
  baseRestorationMatch: boolean;
  lifecycle: ComparisonLifecycleEvidence;
}

async function collect(engine: LocalCartridgeEngine, request: GenerationRequest): Promise<GenerationOutput> {
  let text = '';
  let metrics: GenerationOutput['metrics'] = null;
  for await (const event of engine.generate(request)) {
    if (event.type === 'token') text += event.text;
    if (event.type === 'metrics') metrics = event;
  }
  return { text, metrics };
}

function modeFor(adapter: ActiveAdapterSelection | null): EngineMode {
  return adapter ? { mode: 'adapter', ...adapter } : { mode: 'base' };
}

export interface DemoComparisonResult {
  prompt: string;
  base: GenerationOutput;
  adapted: GenerationOutput;
  previousModeRestored: true;
}

export interface ExperienceComparisonResult<T> {
  base: T;
  adapted: T;
  previousModeRestored: true;
}

/** Run a complete application pipeline once in each mode, then restore the caller's mode and conversation. */
export async function runBaseAdapterExperienceComparison<T>(
  engine: LocalCartridgeEngine,
  adapterId: string,
  runExperience: () => Promise<T>,
  scale = 1,
): Promise<ExperienceComparisonResult<T>> {
  if (engine.getState() !== 'ready') throw new Error('Compare Mode requires a ready local engine.');
  const previousAdapter = engine.getActiveAdapter();
  const previousConversation = engine.getConversationState();
  let base: T | undefined;
  let adapted: T | undefined;
  let operationError: unknown;
  try {
    await engine.clearConversationState();
    await engine.deactivateAdapter();
    base = await runExperience();
    await engine.clearConversationState();
    await engine.activateAdapter(adapterId, scale);
    adapted = await runExperience();
  } catch (error) {
    operationError = error;
  }
  const cleanupErrors: unknown[] = [];
  try { await engine.clearConversationState(); } catch (error) { cleanupErrors.push(error); }
  try {
    if (previousAdapter) await engine.activateAdapter(previousAdapter.id, previousAdapter.scale);
    else await engine.deactivateAdapter();
  } catch (error) { cleanupErrors.push(error); }
  try { await engine.replaceConversationState(previousConversation); } catch (error) { cleanupErrors.push(error); }
  if (operationError || cleanupErrors.length) {
    const errors = operationError ? [operationError, ...cleanupErrors] : cleanupErrors;
    if (errors.length === 1) throw errors[0];
    throw new AggregateError(errors, 'Compare Mode failed and cleanup also encountered an error.');
  }
  if (base === undefined || adapted === undefined) throw new Error('Compare Mode did not complete both experiences.');
  const finalAdapter = engine.getActiveAdapter();
  const restored = previousAdapter
    ? finalAdapter?.id === previousAdapter.id && finalAdapter.scale === previousAdapter.scale
    : finalAdapter === null;
  if (!restored) throw new Error('Compare Mode could not restore the previous engine mode.');
  return { base, adapted, previousModeRestored: true };
}

/** Product-facing two-run comparison. A/B/A remains below for internal lifecycle verification only. */
export async function runBaseAdapterDemoComparison(
  engine: LocalCartridgeEngine,
  adapterId: string,
  request: GenerationRequest,
  scale = 1,
): Promise<DemoComparisonResult> {
  if (engine.getState() !== 'ready') throw new Error('Compare Mode requires a ready local engine.');
  const comparisonRequest = { ...request, seed: request.seed ?? 42, cachePrompt: false };
  const previousAdapter = engine.getActiveAdapter();
  const previousConversation = engine.getConversationState();
  let base: GenerationOutput | null = null;
  let adapted: GenerationOutput | null = null;
  let operationError: unknown;
  try {
    await engine.clearConversationState();
    await engine.deactivateAdapter();
    base = await collect(engine, comparisonRequest);
    await engine.clearConversationState();
    await engine.activateAdapter(adapterId, scale);
    adapted = await collect(engine, comparisonRequest);
  } catch (error) {
    operationError = error;
  }
  const cleanupErrors: unknown[] = [];
  try { await engine.clearConversationState(); } catch (error) { cleanupErrors.push(error); }
  try {
    if (previousAdapter) await engine.activateAdapter(previousAdapter.id, previousAdapter.scale);
    else await engine.deactivateAdapter();
  } catch (error) { cleanupErrors.push(error); }
  try { await engine.replaceConversationState(previousConversation); } catch (error) { cleanupErrors.push(error); }
  if (operationError || cleanupErrors.length) {
    const errors = operationError ? [operationError, ...cleanupErrors] : cleanupErrors;
    if (errors.length === 1) throw errors[0];
    throw new AggregateError(errors, 'Compare Mode failed and cleanup also encountered an error.');
  }
  if (!base || !adapted) throw new Error('Compare Mode did not complete both local generations.');
  const finalAdapter = engine.getActiveAdapter();
  const restored = previousAdapter
    ? finalAdapter?.id === previousAdapter.id && finalAdapter.scale === previousAdapter.scale
    : finalAdapter === null;
  if (!restored) throw new Error('Compare Mode could not restore the previous engine mode.');
  return { prompt: request.prompt, base, adapted, previousModeRestored: true };
}

export async function runBaseAdapterComparison(
  engine: LocalCartridgeEngine,
  adapterId: string,
  request: GenerationRequest,
  scale = 1,
): Promise<ComparisonResult> {
  if (engine.getState() !== 'ready') throw new Error('Compare Mode requires a ready local engine.');
  if (request.temperature !== 0) throw new Error('Compare Mode requires temperature 0 for deterministic A/B/A evidence.');
  const deterministicRequest: GenerationRequest = {
    ...request,
    seed: request.seed ?? 42,
    cachePrompt: false,
  };

  const previousAdapter = engine.getActiveAdapter();
  const previousConversation = engine.getConversationState();
  const sequence: ComparisonLifecycleEvidence['sequence'] = [];
  let baseBefore: GenerationOutput | null = null;
  let adapted: GenerationOutput | null = null;
  let baseAfter: GenerationOutput | null = null;
  let operationError: unknown;

  try {
    await engine.clearConversationState();
    await engine.deactivateAdapter();
    baseBefore = await collect(engine, deterministicRequest);
    sequence.push({ phase: 'baseBefore', mode: 'base', completed: true });

    await engine.clearConversationState();
    await engine.activateAdapter(adapterId, scale);
    adapted = await collect(engine, deterministicRequest);
    sequence.push({ phase: 'adapted', mode: 'adapter', adapterId, scale, completed: true });

    await engine.clearConversationState();
    await engine.deactivateAdapter();
    baseAfter = await collect(engine, deterministicRequest);
    sequence.push({ phase: 'baseAfter', mode: 'base', completed: true });
  } catch (error) {
    operationError = error;
  }

  // Each cleanup operation gets its own attempt so a KV reset failure cannot
  // prevent restoring the mode that the caller had before comparison.
  const cleanupErrors: unknown[] = [];
  try { await engine.clearConversationState(); } catch (error) { cleanupErrors.push(error); }
  try {
    if (previousAdapter) await engine.activateAdapter(previousAdapter.id, previousAdapter.scale);
    else await engine.deactivateAdapter();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try { await engine.replaceConversationState(previousConversation); } catch (error) { cleanupErrors.push(error); }

  if (operationError || cleanupErrors.length) {
    const errors = operationError ? [operationError, ...cleanupErrors] : cleanupErrors;
    if (errors.length === 1) throw errors[0];
    throw new AggregateError(errors, 'Compare Mode failed and cleanup also encountered an error.');
  }
  if (!baseBefore || !adapted || !baseAfter) throw new Error('Compare Mode did not complete all three local generations.');

  const finalAdapter = engine.getActiveAdapter();
  const previousModeRestored = previousAdapter
    ? finalAdapter?.id === previousAdapter.id && finalAdapter.scale === previousAdapter.scale
    : finalAdapter === null;
  if (!previousModeRestored) throw new Error('Compare Mode could not verify restoration of the previous engine mode.');

  return {
    prompt: request.prompt,
    base: baseBefore,
    baseBefore,
    adapted,
    baseAfter,
    restoredToBase: sequence.some(({ phase }) => phase === 'baseAfter'),
    baseRestorationMatch: baseBefore.text === baseAfter.text,
    lifecycle: {
      previousMode: modeFor(previousAdapter),
      sequence,
      finalMode: modeFor(finalAdapter),
      previousModeRestored: true,
    },
  };
}
