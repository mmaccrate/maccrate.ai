import { describe, expect, it } from 'vitest';
import { EngineStateMachine } from './state-machine';
import { CartridgeEngineError } from './types';

describe('EngineStateMachine', () => {
  it('accepts the complete stock inference lifecycle', () => {
    const machine = new EngineStateMachine();
    expect(machine.transition('downloading-model')).toBe('downloading-model');
    expect(machine.transition('loading-model')).toBe('loading-model');
    expect(machine.transition('ready')).toBe('ready');
    expect(machine.transition('generating')).toBe('generating');
    expect(machine.transition('stopping')).toBe('stopping');
    expect(machine.transition('ready')).toBe('ready');
    expect(machine.transition('disposed')).toBe('disposed');
  });

  it('rejects generation before a model is ready', () => {
    const machine = new EngineStateMachine();
    expect(() => machine.transition('generating')).toThrowError(CartridgeEngineError);
    expect(machine.current).toBe('idle');
  });

  it('does not allow resurrection after disposal', () => {
    const machine = new EngineStateMachine();
    machine.transition('disposed');
    expect(() => machine.transition('idle')).toThrow('disposed -> idle');
  });
});
