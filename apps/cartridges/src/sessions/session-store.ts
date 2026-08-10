import type { PortableJsonValue, PortableMessage } from './portable';

/** Stable in-memory slots used by the cartridge switcher. */
export type BrowserSessionId = 'base' | 'chordbound' | 'visit-prep' | 'weather-radio';

export interface BrowserSessionSnapshot {
  messages: PortableMessage[];
  draft: string;
  scrollPosition: number;
  state?: PortableJsonValue;
}

export interface BrowserSessionUpdate {
  messages?: readonly PortableMessage[];
  draft?: string;
  scrollPosition?: number;
  /** Supplying `undefined` explicitly removes cartridge-specific state. */
  state?: unknown;
}

export type BrowserSessionUpdater = (current: BrowserSessionSnapshot) => BrowserSessionUpdate;

export interface CartridgeSessionStore {
  snapshot(cartridgeId: BrowserSessionId): BrowserSessionSnapshot;
  update(cartridgeId: BrowserSessionId, update: BrowserSessionUpdate | BrowserSessionUpdater): BrowserSessionSnapshot;
  clear(cartridgeId: BrowserSessionId): BrowserSessionSnapshot;
  import(cartridgeId: BrowserSessionId, session: BrowserSessionUpdate): BrowserSessionSnapshot;
}

const SESSION_IDS: readonly BrowserSessionId[] = ['base', 'chordbound', 'visit-prep', 'weather-radio'];
const SESSION_ID_SET = new Set<string>(SESSION_IDS);

function assertSessionId(value: string): asserts value is BrowserSessionId {
  if (!SESSION_ID_SET.has(value)) throw new TypeError(`Unknown cartridge session: ${value}`);
}

function cloneMessages(messages: readonly PortableMessage[]): PortableMessage[] {
  return messages.map((message, index) => {
    if (message === null || typeof message !== 'object') throw new TypeError(`messages[${index}] must be an object`);
    if (message.role !== 'user' && message.role !== 'assistant') {
      throw new TypeError(`messages[${index}].role must be user or assistant`);
    }
    if (typeof message.content !== 'string') throw new TypeError(`messages[${index}].content must be a string`);
    return { role: message.role, content: message.content };
  });
}

function cloneJson(value: unknown, path = 'state', ancestors = new Set<object>()): PortableJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain only finite numbers`);
    return value;
  }
  if (typeof value !== 'object') throw new TypeError(`${path} must be JSON-serializable`);
  if (ancestors.has(value)) throw new TypeError(`${path} must not contain circular references`);

  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item, index) => cloneJson(item, `${path}[${index}]`, ancestors));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} must contain only plain objects`);
    const output: Record<string, PortableJsonValue> = {};
    for (const [key, item] of Object.entries(value)) output[key] = cloneJson(item, `${path}.${key}`, ancestors);
    return output;
  } finally {
    ancestors.delete(value);
  }
}

function emptySession(): BrowserSessionSnapshot {
  return { messages: [], draft: '', scrollPosition: 0 };
}

function cloneSnapshot(session: BrowserSessionSnapshot): BrowserSessionSnapshot {
  return {
    messages: cloneMessages(session.messages),
    draft: session.draft,
    scrollPosition: session.scrollPosition,
    ...(session.state === undefined ? {} : { state: cloneJson(session.state) }),
  };
}

function applyUpdate(current: BrowserSessionSnapshot, update: BrowserSessionUpdate): BrowserSessionSnapshot {
  if (update === null || typeof update !== 'object' || Array.isArray(update)) throw new TypeError('session update must be an object');
  const next = cloneSnapshot(current);
  if (Object.hasOwn(update, 'messages')) {
    if (!Array.isArray(update.messages)) throw new TypeError('messages must be an array');
    next.messages = cloneMessages(update.messages);
  }
  if (Object.hasOwn(update, 'draft')) {
    if (typeof update.draft !== 'string') throw new TypeError('draft must be a string');
    next.draft = update.draft;
  }
  if (Object.hasOwn(update, 'scrollPosition')) {
    if (typeof update.scrollPosition !== 'number' || !Number.isFinite(update.scrollPosition) || update.scrollPosition < 0) {
      throw new TypeError('scrollPosition must be a finite non-negative number');
    }
    next.scrollPosition = update.scrollPosition;
  }
  if (Object.hasOwn(update, 'state')) {
    if (update.state === undefined) delete next.state;
    else next.state = cloneJson(update.state);
  }
  return next;
}

/**
 * Creates a process-local store. It deliberately performs no storage or browser
 * I/O, so sessions survive hot swaps but disappear on page reload.
 */
export function createCartridgeSessionStore(): CartridgeSessionStore {
  const sessions = new Map<BrowserSessionId, BrowserSessionSnapshot>(SESSION_IDS.map((id) => [id, emptySession()]));

  return {
    snapshot(cartridgeId) {
      assertSessionId(cartridgeId);
      return cloneSnapshot(sessions.get(cartridgeId)!);
    },
    update(cartridgeId, update) {
      assertSessionId(cartridgeId);
      const current = sessions.get(cartridgeId)!;
      const patch = typeof update === 'function' ? update(cloneSnapshot(current)) : update;
      const next = applyUpdate(current, patch);
      sessions.set(cartridgeId, next);
      return cloneSnapshot(next);
    },
    clear(cartridgeId) {
      assertSessionId(cartridgeId);
      const next = emptySession();
      sessions.set(cartridgeId, next);
      return cloneSnapshot(next);
    },
    import(cartridgeId, session) {
      assertSessionId(cartridgeId);
      const next = applyUpdate(emptySession(), session);
      sessions.set(cartridgeId, next);
      return cloneSnapshot(next);
    },
  };
}
