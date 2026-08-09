export const PORTABLE_SESSION_SCHEMA_VERSION = 1 as const;
export const PORTABLE_SESSION_KIND = 'maccrate-cartridge-session' as const;

export const PORTABLE_SESSION_LIMITS = Object.freeze({
  maxJsonBytes: 1_000_000,
  maxMessages: 500,
  maxMessageChars: 32_000,
  maxTotalMessageChars: 250_000,
  maxStateBytes: 500_000,
  maxStateDepth: 20,
  maxStateEntries: 10_000,
});

export type PortableMessageRole = 'user' | 'assistant';

export interface PortableMessage {
  role: PortableMessageRole;
  content: string;
}

export type PortableJsonValue =
  | null
  | boolean
  | number
  | string
  | PortableJsonValue[]
  | { [key: string]: PortableJsonValue };

export interface PortableSessionV1 {
  kind: typeof PORTABLE_SESSION_KIND;
  schemaVersion: typeof PORTABLE_SESSION_SCHEMA_VERSION;
  cartridgeId: string;
  exportedAt: string;
  messages: PortableMessage[];
  state?: PortableJsonValue;
}

export interface PortableSessionInput {
  cartridgeId: string;
  messages?: readonly PortableMessage[];
  state?: unknown;
  exportedAt?: Date | string;
}

export type PortableSessionValidationResult =
  | { ok: true; value: PortableSessionV1 }
  | { ok: false; errors: string[] };

const cartridgeIdPattern = /^[a-z0-9](?:[a-z0-9._-]{0,127})$/i;
const blockedStateKeyPattern = /^(?:diagnostics?|credentials?|password|secret|token|api[_-]?key|authorization)$/i;
const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function byteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

interface StateBudget { entries: number; errors: string[] }

function cleanState(value: unknown, path: string, depth: number, budget: StateBudget): PortableJsonValue | undefined {
  if (depth > PORTABLE_SESSION_LIMITS.maxStateDepth) {
    budget.errors.push(`${path} exceeds the maximum depth`);
    return undefined;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) budget.errors.push(`${path} must contain only finite numbers`);
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    const result: PortableJsonValue[] = [];
    for (let index = 0; index < value.length; index += 1) {
      budget.entries += 1;
      if (budget.entries > PORTABLE_SESSION_LIMITS.maxStateEntries) {
        budget.errors.push('state has too many entries');
        return undefined;
      }
      const item = cleanState(value[index], `${path}[${index}]`, depth + 1, budget);
      if (item !== undefined) result.push(item);
    }
    return result;
  }
  if (isRecord(value)) {
    const result: Record<string, PortableJsonValue> = {};
    for (const [key, itemValue] of Object.entries(value)) {
      if (blockedStateKeyPattern.test(key)) continue;
      budget.entries += 1;
      if (budget.entries > PORTABLE_SESSION_LIMITS.maxStateEntries) {
        budget.errors.push('state has too many entries');
        return undefined;
      }
      const item = cleanState(itemValue, `${path}.${key}`, depth + 1, budget);
      if (item !== undefined) result[key] = item;
    }
    return result;
  }
  budget.errors.push(`${path} contains a non-JSON value`);
  return undefined;
}

function validateAndClean(input: unknown, expectedCartridgeId?: string): PortableSessionValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['session must be an object'] };
  if (input.kind !== PORTABLE_SESSION_KIND) errors.push(`kind must be ${PORTABLE_SESSION_KIND}`);
  if (input.schemaVersion !== PORTABLE_SESSION_SCHEMA_VERSION) errors.push('schemaVersion must be 1');

  const cartridgeId = input.cartridgeId;
  if (typeof cartridgeId !== 'string' || !cartridgeIdPattern.test(cartridgeId)) {
    errors.push('cartridgeId must be a valid cartridge identifier');
  } else if (expectedCartridgeId !== undefined && cartridgeId !== expectedCartridgeId) {
    errors.push(`session belongs to cartridge ${cartridgeId}, not ${expectedCartridgeId}`);
  }

  const exportedAt = input.exportedAt;
  if (typeof exportedAt !== 'string' || !Number.isFinite(Date.parse(exportedAt))) {
    errors.push('exportedAt must be a valid date string');
  }

  const messages: PortableMessage[] = [];
  let totalChars = 0;
  if (!Array.isArray(input.messages)) {
    errors.push('messages must be an array');
  } else if (input.messages.length > PORTABLE_SESSION_LIMITS.maxMessages) {
    errors.push(`messages must contain at most ${PORTABLE_SESSION_LIMITS.maxMessages} items`);
  } else {
    input.messages.forEach((candidate, index) => {
      if (!isRecord(candidate)) {
        errors.push(`messages[${index}] must be an object`);
        return;
      }
      if (candidate.role !== 'user' && candidate.role !== 'assistant') {
        errors.push(`messages[${index}].role must be user or assistant`);
      }
      if (typeof candidate.content !== 'string') {
        errors.push(`messages[${index}].content must be a string`);
      } else {
        totalChars += candidate.content.length;
        if (candidate.content.length > PORTABLE_SESSION_LIMITS.maxMessageChars) {
          errors.push(`messages[${index}].content is too long`);
        }
      }
      if ((candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string') {
        messages.push({ role: candidate.role, content: candidate.content });
      }
    });
  }
  if (totalChars > PORTABLE_SESSION_LIMITS.maxTotalMessageChars) errors.push('total message content is too long');

  let state: PortableJsonValue | undefined;
  if (input.state !== undefined) {
    const budget: StateBudget = { entries: 0, errors };
    state = cleanState(input.state, 'state', 0, budget);
    if (state !== undefined && byteLength(JSON.stringify(state)) > PORTABLE_SESSION_LIMITS.maxStateBytes) {
      errors.push('state is too large');
    }
  }

  if (errors.length > 0 || typeof cartridgeId !== 'string' || typeof exportedAt !== 'string') {
    return { ok: false, errors };
  }
  const value: PortableSessionV1 = {
    kind: PORTABLE_SESSION_KIND,
    schemaVersion: PORTABLE_SESSION_SCHEMA_VERSION,
    cartridgeId,
    exportedAt: new Date(exportedAt).toISOString(),
    messages,
  };
  if (state !== undefined) value.state = state;
  return { ok: true, value };
}

export function validatePortableSession(input: unknown, expectedCartridgeId?: string): PortableSessionValidationResult {
  return validateAndClean(input, expectedCartridgeId);
}

export function createPortableSession(input: PortableSessionInput): PortableSessionV1 {
  const candidate = {
    kind: PORTABLE_SESSION_KIND,
    schemaVersion: PORTABLE_SESSION_SCHEMA_VERSION,
    cartridgeId: input.cartridgeId,
    exportedAt: input.exportedAt instanceof Date
      ? input.exportedAt.toISOString()
      : input.exportedAt ?? new Date().toISOString(),
    messages: input.messages ?? [],
    ...(input.state === undefined ? {} : { state: input.state }),
  };
  const result = validateAndClean(candidate, input.cartridgeId);
  if (!result.ok) throw new TypeError(`Invalid portable session: ${result.errors.join('; ')}`);
  return result.value;
}

export function serializePortableSession(session: PortableSessionV1): string {
  const result = validateAndClean(session, session.cartridgeId);
  if (!result.ok) throw new TypeError(`Invalid portable session: ${result.errors.join('; ')}`);
  const json = JSON.stringify(result.value, null, 2);
  if (byteLength(json) > PORTABLE_SESSION_LIMITS.maxJsonBytes) throw new RangeError('Portable session is too large');
  return json;
}

export function parsePortableSession(json: string, expectedCartridgeId: string): PortableSessionValidationResult {
  if (typeof json !== 'string') return { ok: false, errors: ['session JSON must be a string'] };
  if (byteLength(json) > PORTABLE_SESSION_LIMITS.maxJsonBytes) return { ok: false, errors: ['session JSON is too large'] };
  let input: unknown;
  try {
    input = JSON.parse(json) as unknown;
  } catch {
    return { ok: false, errors: ['session JSON is invalid'] };
  }
  return validateAndClean(input, expectedCartridgeId);
}

export function createPortableSessionBlob(session: PortableSessionV1): Blob {
  return new Blob([serializePortableSession(session)], { type: 'application/json;charset=utf-8' });
}

export function portableSessionFilename(cartridgeId: string): string {
  if (!cartridgeIdPattern.test(cartridgeId)) throw new TypeError('Invalid cartridge identifier');
  return `${cartridgeId}-session.json`;
}
