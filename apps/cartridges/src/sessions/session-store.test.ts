import { describe, expect, it } from 'vitest';
import { createCartridgeSessionStore, type BrowserSessionId } from './session-store';

const ids: BrowserSessionId[] = ['base', 'chordbound', 'visit-prep', 'weather-radio'];

describe('per-cartridge browser session store', () => {
  it('starts each supported cartridge with an independent empty session', () => {
    const store = createCartridgeSessionStore();
    for (const id of ids) expect(store.snapshot(id)).toEqual({ messages: [], draft: '', scrollPosition: 0 });

    store.update('base', { messages: [{ role: 'user', content: 'baseline' }], draft: 'unfinished', scrollPosition: 18 });
    expect(store.snapshot('base')).toEqual({
      messages: [{ role: 'user', content: 'baseline' }],
      draft: 'unfinished',
      scrollPosition: 18,
    });
    for (const id of ids.slice(1)) expect(store.snapshot(id)).toEqual({ messages: [], draft: '', scrollPosition: 0 });
  });

  it('updates each field incrementally and supports updater functions', () => {
    const store = createCartridgeSessionStore();
    store.update('chordbound', { draft: 'START', state: { turn: 1, legalMoves: ['bebop'] } });
    const result = store.update('chordbound', (current) => ({
      messages: [...current.messages, { role: 'user', content: current.draft }],
      draft: '',
      scrollPosition: 240.5,
      state: { turn: 2 },
    }));
    expect(result).toEqual({
      messages: [{ role: 'user', content: 'START' }],
      draft: '',
      scrollPosition: 240.5,
      state: { turn: 2 },
    });
  });

  it('defensively clones update input, updater input, return values, and snapshots', () => {
    const store = createCartridgeSessionStore();
    const messages = [{ role: 'user' as const, content: 'original' }];
    const state = { nested: { score: 3 } };
    const returned = store.update('visit-prep', { messages, state });
    messages[0].content = 'mutated input';
    state.nested.score = 99;
    returned.messages[0].content = 'mutated return';
    (returned.state as { nested: { score: number } }).nested.score = 100;

    store.update('visit-prep', (current) => {
      current.messages[0].content = 'mutated updater snapshot';
      return { draft: 'safe' };
    });
    const snapshot = store.snapshot('visit-prep');
    snapshot.messages.length = 0;

    expect(store.snapshot('visit-prep')).toEqual({
      messages: [{ role: 'user', content: 'original' }],
      draft: 'safe',
      scrollPosition: 0,
      state: { nested: { score: 3 } },
    });
  });

  it('imports as a replacement and clears only the selected cartridge', () => {
    const store = createCartridgeSessionStore();
    store.update('weather-radio', { draft: 'old', state: { stale: true } });
    store.update('base', { draft: 'keep me' });

    expect(store.import('weather-radio', {
      messages: [{ role: 'assistant', content: 'Forecast ready' }],
      scrollPosition: 12,
      state: { units: 'metric' },
    })).toEqual({
      messages: [{ role: 'assistant', content: 'Forecast ready' }],
      draft: '',
      scrollPosition: 12,
      state: { units: 'metric' },
    });
    expect(store.clear('weather-radio')).toEqual({ messages: [], draft: '', scrollPosition: 0 });
    expect(store.snapshot('base').draft).toBe('keep me');
  });

  it('removes state explicitly and rejects invalid or non-serializable data atomically', () => {
    const store = createCartridgeSessionStore();
    store.update('chordbound', { draft: 'preserved', state: { turn: 1 } });
    expect(store.update('chordbound', { state: undefined })).toEqual({ messages: [], draft: 'preserved', scrollPosition: 0 });

    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => store.update('chordbound', { state: circular })).toThrow(/circular/);
    expect(() => store.update('chordbound', { state: { bad: Number.NaN } })).toThrow(/finite/);
    expect(() => store.update('chordbound', { state: new Date() })).toThrow(/plain objects/);
    expect(() => store.update('chordbound', { scrollPosition: -1 })).toThrow(/non-negative/);
    expect(() => store.import('chordbound', { draft: 'replacement', state: { callback: () => undefined } })).toThrow(/JSON-serializable/);
    expect(store.snapshot('chordbound')).toEqual({ messages: [], draft: 'preserved', scrollPosition: 0 });
  });

  it('does not read from or write to browser persistence', () => {
    const original = globalThis.localStorage;
    const storage = new Proxy({}, { get: () => { throw new Error('localStorage accessed'); } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    try {
      const first = createCartridgeSessionStore();
      first.update('base', { draft: 'memory only' });
      expect(createCartridgeSessionStore().snapshot('base').draft).toBe('');
    } finally {
      if (original === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
      else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
    }
  });
});
