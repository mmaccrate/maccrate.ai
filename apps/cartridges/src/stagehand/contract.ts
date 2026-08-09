export const STAGEHAND_SCHEMA_VERSION = 'stagehand-scene-v1';
export const STAGEHAND_SCENE_ID = 'late-night-broadcast';

export const STAGEHAND_TARGETS = [
  'background', 'border', 'logo', 'title', 'subtitle', 'waveform', 'panel',
  'spotlight-a', 'spotlight-b', 'grain', 'noise',
] as const;
export type StagehandTarget = typeof STAGEHAND_TARGETS[number];
export type StagehandResult = 'apply' | 'clarify' | 'unsupported' | 'noop' | 'help';

export interface StagehandObject {
  visible: boolean;
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  color: string;
  z: number;
  text?: string;
}
export interface StagehandScene {
  version: typeof STAGEHAND_SCHEMA_VERSION;
  sceneId: typeof STAGEHAND_SCENE_ID;
  objects: Record<StagehandTarget, StagehandObject>;
}
export type StagehandOperation =
  | { op: 'move'; target: StagehandTarget; x: number; y: number }
  | { op: 'visibility'; target: StagehandTarget; value: 'show' | 'hide' }
  | { op: 'color'; target: StagehandTarget; value: string }
  | { op: 'opacity'; target: StagehandTarget; value: number }
  | { op: 'scale'; target: StagehandTarget; value: number }
  | { op: 'rotate'; target: StagehandTarget; degrees: number }
  | { op: 'layer'; target: StagehandTarget; placement: 'front' | 'back' }
  | { op: 'reset'; target: StagehandTarget | 'scene' };
export interface StagehandResponse {
  result: StagehandResult;
  ops?: StagehandOperation[];
  reason_code?: string;
  question?: string;
  choices?: string[];
  message?: string;
  suggestions?: string[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const HEX = /^#[0-9a-fA-F]{6}$/;
const targetSet = new Set<string>(STAGEHAND_TARGETS);
const movable = new Set<StagehandTarget>(['logo', 'title', 'subtitle', 'waveform', 'panel', 'spotlight-a', 'spotlight-b']);
const visible = new Set<StagehandTarget>(STAGEHAND_TARGETS.filter((target) => target !== 'background'));
const colored = new Set<StagehandTarget>(['background', 'border', 'logo', 'title', 'subtitle', 'waveform', 'panel', 'spotlight-a', 'spotlight-b']);
const opacity = new Set<StagehandTarget>(['border', 'logo', 'title', 'subtitle', 'waveform', 'panel', 'spotlight-a', 'spotlight-b', 'grain', 'noise']);
const layered = new Set<StagehandTarget>(['border', 'logo', 'title', 'subtitle', 'waveform', 'panel', 'spotlight-a', 'spotlight-b']);
const unsupportedReasons = new Set(['unknown_object', 'new_object_creation', 'new_object_and_animation', 'animation_or_physics', 'new_asset_or_drawing', 'unsupported_text_edit', 'unsupported_property', 'unsupported_external_action', 'mixed_supported_and_unsupported', 'too_many_operations', 'conflicting_request']);
const clarifyReasons = new Set(['ambiguous_target', 'missing_target', 'missing_value', 'ambiguous_value', 'conflicting_request', 'mixed_request_needs_confirmation']);

export const INITIAL_STAGEHAND_SCENE: StagehandScene = {
  version: STAGEHAND_SCHEMA_VERSION,
  sceneId: STAGEHAND_SCENE_ID,
  objects: {
    background: { visible: true, x: .5, y: .5, scale: 1, rotationDeg: 0, opacity: 1, color: '#0e1018', z: 0 },
    border: { visible: true, x: .5, y: .5, scale: 1, rotationDeg: 0, opacity: .82, color: '#68738d', z: 1 },
    logo: { visible: true, x: .16, y: .12, scale: 1, rotationDeg: 0, opacity: 1, color: '#f2efe4', z: 8 },
    title: { visible: true, x: .5, y: .33, scale: 1, rotationDeg: 0, opacity: 1, color: '#f2efe4', z: 9, text: 'NIGHT SIGNAL' },
    subtitle: { visible: true, x: .5, y: .43, scale: 1, rotationDeg: 0, opacity: .78, color: '#a7afbf', z: 10, text: 'LIVE FROM THE STUDIO' },
    waveform: { visible: true, x: .5, y: .64, scale: 1, rotationDeg: 0, opacity: .88, color: '#55d6be', z: 6 },
    panel: { visible: true, x: .5, y: .78, scale: 1, rotationDeg: 0, opacity: .86, color: '#1d2738', z: 3 },
    'spotlight-a': { visible: false, x: .18, y: .58, scale: 1, rotationDeg: 0, opacity: .62, color: '#d88932', z: 4 },
    'spotlight-b': { visible: false, x: .82, y: .58, scale: 1, rotationDeg: 0, opacity: .62, color: '#4b82d8', z: 5 },
    grain: { visible: true, x: .5, y: .5, scale: 1, rotationDeg: 0, opacity: .16, color: '#ffffff', z: 11 },
    noise: { visible: true, x: .5, y: .5, scale: 1, rotationDeg: 0, opacity: .11, color: '#ffffff', z: 12 },
  },
};

export function initialStagehandScene(): StagehandScene { return clone(INITIAL_STAGEHAND_SCENE); }

function exactKeys(value: Record<string, unknown>, allowed: string[], required: string[], label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => !(key in value));
  if (unknown.length) throw new StagehandContractError(`${label} contains unknown fields: ${unknown.join(', ')}`);
  if (missing.length) throw new StagehandContractError(`${label} is missing: ${missing.join(', ')}`);
}

export class StagehandContractError extends Error {
  constructor(message: string) { super(message); this.name = 'StagehandContractError'; }
}

function validateOperation(value: unknown): StagehandOperation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StagehandContractError('Each operation must be an object.');
  const op = value as Record<string, unknown>;
  const name = op.op;
  const target = op.target;
  if (name === 'reset') {
    exactKeys(op, ['op', 'target'], ['op', 'target'], 'reset');
    if (op.target !== 'scene' && (typeof op.target !== 'string' || !targetSet.has(op.target))) throw new StagehandContractError('Reset target is not authored.');
    return { op: 'reset', target: op.target as StagehandTarget | 'scene' };
  }
  if (typeof target !== 'string' || !targetSet.has(target)) throw new StagehandContractError('Operation target is not an authored scene object.');
  const typedTarget = target as StagehandTarget;
  if (name === 'move') {
    exactKeys(op, ['op', 'target', 'x', 'y'], ['op', 'target', 'x', 'y'], 'move');
    if (!movable.has(typedTarget) || !isNumber(op.x) || !isNumber(op.y) || op.x < 0 || op.x > 1 || op.y < 0 || op.y > 1) throw new StagehandContractError('Move is outside the authored scene contract.');
    return { op: 'move', target: typedTarget, x: op.x, y: op.y };
  }
  if (name === 'visibility') {
    exactKeys(op, ['op', 'target', 'value'], ['op', 'target', 'value'], 'visibility');
    if (!visible.has(typedTarget) || (op.value !== 'show' && op.value !== 'hide')) throw new StagehandContractError('Visibility is outside the authored scene contract.');
    return { op: 'visibility', target: typedTarget, value: op.value };
  }
  if (name === 'color') {
    exactKeys(op, ['op', 'target', 'value'], ['op', 'target', 'value'], 'color');
    if (!colored.has(typedTarget) || typeof op.value !== 'string' || !HEX.test(op.value)) throw new StagehandContractError('Color must be a six-digit hexadecimal value for an authored target.');
    return { op: 'color', target: typedTarget, value: op.value.toLowerCase() };
  }
  if (name === 'opacity') {
    exactKeys(op, ['op', 'target', 'value'], ['op', 'target', 'value'], 'opacity');
    if (!opacity.has(typedTarget) || !isNumber(op.value) || op.value < 0 || op.value > 1) throw new StagehandContractError('Opacity is outside the authored scene contract.');
    return { op: 'opacity', target: typedTarget, value: op.value };
  }
  if (name === 'scale') {
    exactKeys(op, ['op', 'target', 'value'], ['op', 'target', 'value'], 'scale');
    if (!movable.has(typedTarget) || !isNumber(op.value) || op.value < .5 || op.value > 2) throw new StagehandContractError('Scale is outside the authored scene contract.');
    return { op: 'scale', target: typedTarget, value: op.value };
  }
  if (name === 'rotate') {
    exactKeys(op, ['op', 'target', 'degrees'], ['op', 'target', 'degrees'], 'rotate');
    if (!movable.has(typedTarget) || !isNumber(op.degrees) || op.degrees < -180 || op.degrees > 180) throw new StagehandContractError('Rotation is outside the authored scene contract.');
    return { op: 'rotate', target: typedTarget, degrees: op.degrees };
  }
  if (name === 'layer') {
    exactKeys(op, ['op', 'target', 'placement'], ['op', 'target', 'placement'], 'layer');
    if (!layered.has(typedTarget) || (op.placement !== 'front' && op.placement !== 'back')) throw new StagehandContractError('Layer placement is outside the authored scene contract.');
    return { op: 'layer', target: typedTarget, placement: op.placement };
  }
  throw new StagehandContractError('Unknown operation.');
}

export function parseStagehandResponse(raw: string): StagehandResponse {
  if (!raw.trim()) throw new StagehandContractError('The cartridge returned an empty response.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new StagehandContractError('The cartridge did not return strict JSON.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new StagehandContractError('The cartridge response must be one JSON object.');
  const value = parsed as Record<string, unknown>;
  const result = value.result;
  if (!['apply', 'clarify', 'unsupported', 'noop', 'help'].includes(String(result))) throw new StagehandContractError('The response result is not supported.');
  if (typeof value.message !== 'undefined' && (typeof value.message !== 'string' || !value.message.trim())) throw new StagehandContractError('The response message must be plain text.');
  if (result === 'apply') {
    exactKeys(value, ['result', 'ops', 'message'], ['result', 'ops'], 'apply');
    if (!Array.isArray(value.ops) || value.ops.length < 1 || value.ops.length > 5) throw new StagehandContractError('An apply plan must contain 1–5 operations.');
    if (value.ops.some((entry) => (entry as Record<string, unknown>)?.op === 'reset') && value.ops.length !== 1) throw new StagehandContractError('Reset must be the only operation.');
    const operations = value.ops.map(validateOperation);
    const seen = new Set<string>();
    for (const operation of operations) {
      const key = operation.op === 'reset' ? 'reset' : `${operation.target}:${operation.op === 'move' ? 'move' : operation.op}`;
      if (seen.has(key)) throw new StagehandContractError('An apply plan repeats the same target property.');
      seen.add(key);
    }
    return { result: 'apply', ops: operations, ...(typeof value.message === 'string' ? { message: value.message } : {}) };
  }
  exactKeys(value, ['result', 'reason_code', 'question', 'choices', 'message', 'suggestions'], ['result', ...(result === 'clarify' ? ['reason_code', 'question'] : [])], String(result));
  if (result === 'clarify' && (typeof value.question !== 'string' || !value.question.trim())) throw new StagehandContractError('Clarification needs a question.');
  if (result === 'clarify' && (typeof value.reason_code !== 'string' || !clarifyReasons.has(value.reason_code))) throw new StagehandContractError('Clarification reason code is not supported.');
  if (result === 'unsupported' && (typeof value.reason_code !== 'string' || !unsupportedReasons.has(value.reason_code))) throw new StagehandContractError('Unsupported reason code is not supported.');
  if (result === 'help' && !Array.isArray(value.suggestions)) throw new StagehandContractError('Help responses need suggestions.');
  const textArray = (key: string): string[] | undefined => {
    if (value[key] === undefined) return undefined;
    if (!Array.isArray(value[key]) || value[key].some((item) => typeof item !== 'string')) throw new StagehandContractError(`${key} must contain plain strings.`);
    return value[key] as string[];
  };
  return {
    result: result as Exclude<StagehandResult, 'apply'>,
    ...(typeof value.reason_code === 'string' ? { reason_code: value.reason_code } : {}),
    ...(typeof value.question === 'string' ? { question: value.question } : {}),
    ...(typeof value.message === 'string' ? { message: value.message } : {}),
    ...(textArray('choices') ? { choices: textArray('choices') } : {}),
    ...(textArray('suggestions') ? { suggestions: textArray('suggestions') } : {}),
  };
}

function setLayer(scene: StagehandScene, target: StagehandTarget, placement: 'front' | 'back'): void {
  const zValues = STAGEHAND_TARGETS.map((id) => scene.objects[id].z);
  scene.objects[target].z = placement === 'front' ? Math.max(...zValues) + 1 : Math.min(...zValues) - 1;
}

export function applyStagehandResponse(scene: StagehandScene, response: StagehandResponse): StagehandScene {
  if (response.result !== 'apply' || !response.ops) return clone(scene);
  const next = clone(scene);
  for (const operation of response.ops) {
    if (operation.op === 'reset') {
      if (operation.target === 'scene') return initialStagehandScene();
      next.objects[operation.target] = clone(INITIAL_STAGEHAND_SCENE.objects[operation.target]);
      continue;
    }
    const object = next.objects[operation.target];
    if (operation.op === 'move') { object.x = operation.x; object.y = operation.y; }
    if (operation.op === 'visibility') object.visible = operation.value === 'show';
    if (operation.op === 'color') object.color = operation.value;
    if (operation.op === 'opacity') object.opacity = operation.value;
    if (operation.op === 'scale') object.scale = operation.value;
    if (operation.op === 'rotate') object.rotationDeg = operation.degrees;
    if (operation.op === 'layer') setLayer(next, operation.target, operation.placement);
  }
  return next;
}

export const STAGEHAND_SYSTEM_PROMPT = `You are Stagehand, a strict editor for one authored static broadcast scene.
Return exactly one JSON object and no Markdown, prose, or code fences.
The current scene state is supplied with each request. Preserve every property not named by an operation.

Legal targets: background, border, logo, title, subtitle, waveform, panel, spotlight-a, spotlight-b, grain, noise.
Legal operations:
- move: {op, target, x, y}; x/y absolute numbers in [0,1]; only logo/title/subtitle/waveform/panel/spotlights.
- visibility: {op, target, value}; value show|hide; all except background.
- color: {op, target, value}; value #RRGGBB; background, border, logo, title, subtitle, waveform, panel, spotlights.
- opacity: {op, target, value}; value [0,1]; border, logo, title, subtitle, waveform, panel, spotlights, grain, noise.
- scale: {op, target, value}; value [0.5,2.0]; logo/title/subtitle/waveform/panel/spotlights.
- rotate: {op, target, degrees}; degrees [-180,180]; logo/title/subtitle/waveform/panel/spotlights.
- layer: {op, target, placement}; placement front|back; border, logo, title, subtitle, waveform, panel, spotlights.
- reset: {op, target}; target scene or one legal target; reset must be the only operation.
An apply response contains 1-5 operations. Only apply changes the scene.

If a request is ambiguous but supported, return {result, reason_code, question} as clarify; do not guess.
If it asks for an unknown/new object, drawing, animation, arbitrary text, audio, code, or external browser action, return unsupported with a plain-language message and supported suggestions. Never substitute a nearby object or apply only a partial mixed request.
Other result types: noop when the requested state already holds; help for capability questions.`;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

export function stagehandPrompt(scene: StagehandScene, request: string): string {
  return `CURRENT_SCENE:\n${JSON.stringify(canonicalize(scene))}\nREQUEST:\n${request}`;
}

// Contract-shaped grammar: generation may choose any legal response/operation,
// while the controller still validates semantics and applies atomically.
export const STAGEHAND_JSON_GRAMMAR = String.raw`root ::= apply | clarify | unsupported | noop | help
apply ::= "{" ws result-apply "," ws "\"ops\"" ws ":" ws "[" ws operation ("," ws operation){0,4} ws "]" ("," ws message)? ws "}"
clarify ::= "{" ws result-clarify "," ws "\"reason_code\"" ws ":" ws reason "," ws "\"question\"" ws ":" ws string ("," ws "\"choices\"" ws ":" ws string-array)? ws "}"
unsupported ::= "{" ws result-unsupported "," ws "\"reason_code\"" ws ":" ws reason "," ws message ("," ws suggestions)? ws "}"
noop ::= "{" ws result-noop "," ws message ws "}"
help ::= "{" ws result-help "," ws message "," ws suggestions ws "}"
result-apply ::= "\"result\"" ws ":" ws "\"apply\""
result-clarify ::= "\"result\"" ws ":" ws "\"clarify\""
result-unsupported ::= "\"result\"" ws ":" ws "\"unsupported\""
result-noop ::= "\"result\"" ws ":" ws "\"noop\""
result-help ::= "\"result\"" ws ":" ws "\"help\""
message ::= "\"message\"" ws ":" ws string
suggestions ::= "\"suggestions\"" ws ":" ws string-array
operation ::= move | visibility | color | opacity | scale | rotate | layer | reset
move ::= "{" ws "\"op\"" ws ":" ws "\"move\"" "," ws target "," ws "\"x\"" ws ":" ws number "," ws "\"y\"" ws ":" ws number ws "}"
visibility ::= "{" ws "\"op\"" ws ":" ws "\"visibility\"" "," ws target "," ws "\"value\"" ws ":" ws ("\"show\"" | "\"hide\"") ws "}"
color ::= "{" ws "\"op\"" ws ":" ws "\"color\"" "," ws target "," ws "\"value\"" ws ":" ws string ws "}"
opacity ::= "{" ws "\"op\"" ws ":" ws "\"opacity\"" "," ws target "," ws "\"value\"" ws ":" ws number ws "}"
scale ::= "{" ws "\"op\"" ws ":" ws "\"scale\"" "," ws target "," ws "\"value\"" ws ":" ws number ws "}"
rotate ::= "{" ws "\"op\"" ws ":" ws "\"rotate\"" "," ws target "," ws "\"degrees\"" ws ":" ws number ws "}"
layer ::= "{" ws "\"op\"" ws ":" ws "\"layer\"" "," ws target "," ws "\"placement\"" ws ":" ws ("\"front\"" | "\"back\"") ws "}"
reset ::= "{" ws "\"op\"" ws ":" ws "\"reset\"" "," ws "\"target\"" ws ":" ws (target-value | "\"scene\"") ws "}"
target ::= "\"target\"" ws ":" ws target-value
target-value ::= "\"background\"" | "\"border\"" | "\"logo\"" | "\"title\"" | "\"subtitle\"" | "\"waveform\"" | "\"panel\"" | "\"spotlight-a\"" | "\"spotlight-b\"" | "\"grain\"" | "\"noise\""
reason ::= "\"unknown_object\"" | "\"new_object_creation\"" | "\"new_object_and_animation\"" | "\"animation_or_physics\"" | "\"new_asset_or_drawing\"" | "\"unsupported_text_edit\"" | "\"unsupported_property\"" | "\"unsupported_external_action\"" | "\"mixed_supported_and_unsupported\"" | "\"too_many_operations\"" | "\"conflicting_request\"" | "\"ambiguous_target\"" | "\"missing_target\"" | "\"missing_value\"" | "\"ambiguous_value\"" | "\"mixed_request_needs_confirmation\""
string-array ::= "[" ws (string ("," ws string)*)? ws "]"
string ::= "\"" char* "\""
char ::= [^"\\] | "\\" escape
escape ::= ["\\/bfnrt] | "u" [0-9a-fA-F]{4}
number ::= "-"? ("0" | [1-9] [0-9]*) ("." [0-9]+)? ([eE] [-+]? [0-9]+)?
ws ::= [ \t\n]*`;
