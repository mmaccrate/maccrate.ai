import { CartridgeEngineError, type EngineState } from './types';

const transitions: Record<EngineState, ReadonlySet<EngineState>> = {
  unsupported: new Set(['idle', 'disposed']),
  idle: new Set(['unsupported', 'downloading-model', 'loading-model', 'disposed']),
  'downloading-model': new Set(['loading-model', 'failed', 'disposed']),
  'loading-model': new Set(['ready', 'failed', 'disposed']),
  ready: new Set(['generating', 'loading-adapter', 'switching-adapter', 'idle', 'failed', 'disposed']),
  generating: new Set(['ready', 'stopping', 'failed', 'disposed']),
  stopping: new Set(['ready', 'failed', 'disposed']),
  'loading-adapter': new Set(['ready', 'failed', 'disposed']),
  'switching-adapter': new Set(['ready', 'failed', 'disposed']),
  failed: new Set(['idle', 'downloading-model', 'loading-model', 'disposed']),
  disposed: new Set(),
};

export class EngineStateMachine {
  constructor(private state: EngineState = 'idle') {}

  get current(): EngineState {
    return this.state;
  }

  canTransition(next: EngineState): boolean {
    return this.state === next || transitions[this.state].has(next);
  }

  transition(next: EngineState): EngineState {
    if (!this.canTransition(next)) {
      throw new CartridgeEngineError(
        'invalid-state',
        `Invalid engine transition: ${this.state} -> ${next}`,
      );
    }
    this.state = next;
    return this.state;
  }
}
