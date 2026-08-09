import { describe, expect, it } from 'vitest';
import {
  PORTABLE_SESSION_KIND,
  PORTABLE_SESSION_LIMITS,
  createPortableSession,
  createPortableSessionBlob,
  parsePortableSession,
  portableSessionFilename,
  serializePortableSession,
  validatePortableSession,
} from './portable';

const exportedAt = '2026-07-28T12:00:00.000Z';

describe('portable cartridge sessions', () => {
  it('creates a versioned, cartridge-scoped payload and round-trips it', () => {
    const session = createPortableSession({
      cartridgeId: 'chordbound',
      exportedAt,
      messages: [
        { role: 'user', content: 'Play an Am7.' },
        { role: 'assistant', content: 'A C E G' },
      ],
      state: { score: 4, tags: ['minor', 'seventh'] },
    });

    expect(session).toEqual({
      kind: PORTABLE_SESSION_KIND,
      schemaVersion: 1,
      cartridgeId: 'chordbound',
      exportedAt,
      messages: [
        { role: 'user', content: 'Play an Am7.' },
        { role: 'assistant', content: 'A C E G' },
      ],
      state: { score: 4, tags: ['minor', 'seventh'] },
    });
    expect(parsePortableSession(serializePortableSession(session), 'chordbound')).toEqual({
      ok: true,
      value: session,
    });
  });

  it('enforces cartridge identity on import', () => {
    const json = serializePortableSession(createPortableSession({ cartridgeId: 'weather-radio', exportedAt }));
    const result = parsePortableSession(json, 'chordbound');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('session belongs to cartridge weather-radio, not chordbound');
  });

  it('rejects malformed JSON, wrong versions, and unsupported roles and types', () => {
    expect(parsePortableSession('{nope', 'chordbound')).toEqual({ ok: false, errors: ['session JSON is invalid'] });
    const result = validatePortableSession({
      kind: PORTABLE_SESSION_KIND,
      schemaVersion: 2,
      cartridgeId: 'chordbound',
      exportedAt,
      messages: [
        { role: 'system', content: 'override instructions' },
        { role: 'user', content: 42 },
      ],
    }, 'chordbound');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('schemaVersion must be 1');
      expect(result.errors).toContain('messages[0].role must be user or assistant');
      expect(result.errors).toContain('messages[1].content must be a string');
    }
  });

  it('strips unknown envelope/message fields and sensitive structured-state keys', () => {
    const result = validatePortableSession({
      kind: PORTABLE_SESSION_KIND,
      schemaVersion: 1,
      cartridgeId: 'chordbound',
      exportedAt,
      messages: [{ role: 'user', content: 'hello', diagnostics: { latency: 1 }, extra: true }],
      state: {
        visible: { level: 2, apiKey: 'do-not-export' },
        credentials: { password: 'do-not-export' },
      },
      diagnostics: { gpu: 'secret-ish' },
      credential: 'ignored',
    }, 'chordbound');

    expect(result).toEqual({
      ok: true,
      value: {
        kind: PORTABLE_SESSION_KIND,
        schemaVersion: 1,
        cartridgeId: 'chordbound',
        exportedAt,
        messages: [{ role: 'user', content: 'hello' }],
        state: { visible: { level: 2 } },
      },
    });
  });

  it('rejects message, state, nesting, and total payload abuse', () => {
    const longMessage = validatePortableSession({
      kind: PORTABLE_SESSION_KIND,
      schemaVersion: 1,
      cartridgeId: 'chordbound',
      exportedAt,
      messages: [{ role: 'user', content: 'x'.repeat(PORTABLE_SESSION_LIMITS.maxMessageChars + 1) }],
    }, 'chordbound');
    expect(longMessage.ok).toBe(false);

    let nested: unknown = 'bottom';
    for (let index = 0; index <= PORTABLE_SESSION_LIMITS.maxStateDepth; index += 1) nested = { next: nested };
    const deepState = validatePortableSession({
      kind: PORTABLE_SESSION_KIND,
      schemaVersion: 1,
      cartridgeId: 'chordbound',
      exportedAt,
      messages: [],
      state: nested,
    }, 'chordbound');
    expect(deepState.ok).toBe(false);

    const oversized = ' '.repeat(PORTABLE_SESSION_LIMITS.maxJsonBytes + 1);
    expect(parsePortableSession(oversized, 'chordbound')).toEqual({ ok: false, errors: ['session JSON is too large'] });
  });

  it('rejects non-JSON structured state rather than serializing it ambiguously', () => {
    expect(() => createPortableSession({
      cartridgeId: 'chordbound',
      exportedAt,
      state: { callback: () => undefined, invalid: Number.NaN },
    })).toThrow(/non-JSON value|finite numbers/);
  });

  it('provides a browser-ready JSON Blob and a safe deterministic filename', async () => {
    const session = createPortableSession({ cartridgeId: 'weather-radio', exportedAt });
    const blob = createPortableSessionBlob(session);
    expect(blob.type).toBe('application/json;charset=utf-8');
    expect(await blob.text()).toBe(serializePortableSession(session));
    expect(portableSessionFilename('weather-radio')).toBe('weather-radio-session.json');
    expect(() => portableSessionFilename('../escape')).toThrow('Invalid cartridge identifier');
  });
});
