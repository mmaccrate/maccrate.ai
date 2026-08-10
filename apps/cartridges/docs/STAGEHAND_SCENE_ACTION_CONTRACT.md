# Stagehand Scene Action Contract

## Purpose

Stagehand is a bounded scene editor, not a general image generator, animation system, or open-ended design assistant.

The user gives a natural-language instruction. The model returns either:

1. a strict plan of operations against existing authored scene objects;
2. one clarification question when the request is supported but incomplete or ambiguous;
3. an explicit unsupported response when the request is outside the scene contract;
4. a no-op response when the requested state is already true; or
5. a capability/help response when the user asks what Stagehand can do.

The browser executes only a valid, explicit plan. It may parse, validate, apply, render, and score. It must not infer the user's intent, choose an object the model omitted, repair a bad plan, create an object, or silently turn a refusal into a successful scene edit.

This is the contract to freeze before the Stock-only canary. It deliberately contains no dataset-size commitment.

---

## Product boundary

Stagehand edits one authored **late-night broadcast** composition. The scene has a fixed object registry. The model can change properties of those objects, but it cannot invent new scene entities.

### The model can

- move an existing object to an absolute normalized position;
- show or hide an existing object;
- change an existing object's color where that object exposes a color;
- change opacity;
- resize an existing object with a bounded uniform scale;
- rotate an existing object with a bounded angle;
- move an existing layer to the front or back of the authored foreground stack;
- reset one existing object or the complete scene to its authored state;
- explain these capabilities;
- ask a clarification question instead of guessing;
- say that a request is unsupported and direct the user to a supported alternative.

### The model cannot

- add an arbitrary object, illustration, shape, image, or asset;
- create a compound object from multiple new things;
- animate, fly, bounce, orbit, morph, or apply physics;
- draw a free-form path or generate new artwork;
- edit arbitrary title/subtitle copy in the initial canary contract;
- execute JavaScript, CSS, HTML, or arbitrary code;
- change audio, camera behavior, external files, URLs, or browser state;
- choose a “nearest” existing object when the requested object is unknown;
- apply only the easy half of a mixed supported/unsupported request without telling the user and obtaining a new instruction;
- claim that an operation happened when it did not produce a valid plan.

The important user-facing consequence is intentional:

> “Add a flying potato with a banana” is not a scene edit that Stagehand should guess at. It should say that it cannot create new animated objects, then explain what it *can* edit.

An existing spotlight may be described conversationally as “add an amber spotlight” when the intended operation is to reveal `spotlight-a` or `spotlight-b` and set its color. That is not object creation: the model must emit the explicit `visibility` and `color` operations against an existing spotlight.

---

## Authored scene object registry

These IDs are the only legal operation targets in v0.

| ID | Visible role | Initial-canary capabilities |
|---|---|---|
| `background` | canvas/background fill | `color` |
| `border` | frame/border treatment | `visibility`, `color`, `opacity`, `layer` |
| `logo` | broadcast/logo mark | `visibility`, `move`, `color`, `opacity`, `scale`, `rotate`, `layer` |
| `title` | primary title | `visibility`, `move`, `color`, `opacity`, `scale`, `rotate`, `layer` |
| `subtitle` | secondary title | `visibility`, `move`, `color`, `opacity`, `scale`, `rotate`, `layer` |
| `waveform` | signal/waveform graphic | `visibility`, `move`, `color`, `opacity`, `scale`, `rotate`, `layer` |
| `panel` | authored information panel | `visibility`, `move`, `color`, `opacity`, `scale`, `rotate`, `layer` |
| `spotlight-a` | authored left/accent spotlight | `visibility`, `move`, `color`, `opacity`, `scale`, `rotate`, `layer` |
| `spotlight-b` | authored right/accent spotlight | `visibility`, `move`, `color`, `opacity`, `scale`, `rotate`, `layer` |
| `grain` | authored grain texture | `visibility`, `opacity` |
| `noise` | authored noise layer | `visibility`, `opacity` |

There is no `potato`, `banana`, `character`, `particle`, `image`, `shape`, or generic `object` target. An unknown target is not mapped to a nearby target.

### State representation

The model receives the current scene state so it can preserve unspecified properties and reason about whether a request is already satisfied. The state is conceptually:

```ts
interface SceneStateV1 {
  version: "stagehand-scene-v1";
  sceneId: "late-night-broadcast";
  objects: Record<TargetId, {
    visible: boolean;
    x: number;           // normalized 0..1, left to right
    y: number;           // normalized 0..1, top to bottom
    scale: number;       // authored bounded range
    rotationDeg: number;
    opacity: number;     // 0..1
    color?: `#${string}`;
    z: number;
    text?: string;       // read-only in v0
  }>;
}
```

Some fields are read-only or inapplicable for particular objects. The capability table, not the presence of a field, determines whether an operation is legal.

Coordinates are absolute, not deltas. `x: 0` is the left edge, `x: 1` is the right edge, `y: 0` is the top edge, and `y: 1` is the bottom edge. The browser does not calculate a missing coordinate or convert a partial move into a default.

---

## Canonical scene operations

The model must emit only these canonical operation names. Natural-language aliases are handled by the model; aliases are not accepted as browser protocol variants.

### 1. Move an existing object

```json
{"op":"move","target":"title","x":0.16,"y":0.14}
```

Rules:

- `target` must support `move`;
- both `x` and `y` are required numbers in `[0, 1]`;
- the move is absolute;
- a request such as “move it a little left” must be resolved by the model using the supplied state, or the model must ask for clarification; the browser does not invent a delta.

### 2. Show or hide an existing object

```json
{"op":"visibility","target":"subtitle","value":"hide"}
```

Allowed values are exactly `show` and `hide`.

“Add an existing spotlight” may be represented as:

```json
{"op":"visibility","target":"spotlight-a","value":"show"}
```

It does not create a new object.

### 3. Change an existing color

```json
{"op":"color","target":"background","value":"#10141c"}
```

Rules:

- the target must support `color`;
- the value must be a six-digit hexadecimal color;
- color names may be interpreted by the model, but the browser receives only canonical hex;
- if the requested target has no color capability, the whole plan is rejected.

### 4. Change opacity

```json
{"op":"opacity","target":"grain","value":0.24}
```

The value is a number in `[0, 1]`. For `grain` and `noise`, opacity is also the authored intensity control.

### 5. Resize an existing object

```json
{"op":"scale","target":"panel","value":1.15}
```

The value is a bounded uniform scale. The initial contract uses `[0.5, 2.0]`. Non-uniform width/height edits are not supported in v0.

### 6. Rotate an existing object

```json
{"op":"rotate","target":"logo","degrees":-12}
```

The value is a bounded angle in `[-180, 180]` degrees. Animation is not implied: this sets one static rotation.

### 7. Reorder an existing foreground layer

```json
{"op":"layer","target":"title","placement":"front"}
```

Allowed placements are exactly `front` and `back` within the authored foreground stack. Relative instructions such as “put the title behind the panel” are deferred until the contract has an explicit pairwise ordering operation; the model must not silently approximate them with `back`.

### 8. Reset authored state

Resetting the complete scene:

```json
{"op":"reset","target":"scene"}
```

Resetting one object:

```json
{"op":"reset","target":"spotlight-a"}
```

A reset plan must contain no other operations. This prevents unclear order semantics such as “reset the scene, then move the title” from being accepted accidentally.

---

## Response contract: scene actions versus non-actions

The top-level response is one of five mutually exclusive result types. Only `apply` mutates the scene.

### `apply`

Use when the complete request is supported and all intended changes are explicit.

```json
{
  "result":"apply",
  "ops":[
    {"op":"color","target":"background","value":"#10141c"},
    {"op":"move","target":"title","x":0.16,"y":0.14},
    {"op":"visibility","target":"subtitle","value":"hide"},
    {"op":"visibility","target":"spotlight-a","value":"show"},
    {"op":"color","target":"spotlight-a","value":"#d88932"}
  ],
  "message":"I updated the broadcast layout and brought up an amber spotlight."
}
```

Rules:

- `ops` contains 1–5 operations;
- every requested change that the model understood must be represented;
- unspecified properties must be preserved;
- all operations are validated before any operation is committed;
- the browser applies the plan atomically or applies nothing;
- `message` is optional and rendered as text, never HTML.

### `clarify`

Use when the request is within the product boundary but the model cannot safely choose without more information.

```json
{
  "result":"clarify",
  "reason_code":"ambiguous_target",
  "question":"Which spotlight should I change: spotlight A or spotlight B?",
  "choices":["spotlight-a","spotlight-b"]
}
```

Typical clarification cases:

- “Make the spotlight blue” when both spotlights are candidates;
- “Change the color” with no target or color;
- two contradictory changes to the same property;
- a mixed request where the model needs the user to remove the unsupported portion before applying the supported portion.

A `clarify` response has no `ops` and does not change scene state.

### `unsupported`

Use when the requested intent is outside the allowlist. This is the required behavior for the flying-potato example.

```json
{
  "result":"unsupported",
  "reason_code":"new_object_and_animation",
  "message":"I can’t add new arbitrary objects or animate them in this scene. I can edit the existing broadcast elements instead.",
  "suggestions":[
    "move_existing",
    "show_or_hide",
    "change_color",
    "change_opacity",
    "resize_or_rotate",
    "reorder_layers",
    "reset_scene"
  ]
}
```

A valid unsupported response:

- makes no scene mutation;
- names the boundary in plain language;
- does not pretend that a nearby existing object represents the requested object;
- gives one or more supported next directions;
- contains no `ops`.

The browser may map `suggestions` to stable human-facing labels. It must not turn them into operations automatically.

### `noop`

Use when the requested state is already true.

```json
{
  "result":"noop",
  "message":"The subtitle is already hidden."
}
```

A `noop` response has no `ops` and does not change scene state. It is different from a failed parse and different from unsupported intent.

### `help`

Use for “what can you do?” or an equivalent capability request.

```json
{
  "result":"help",
  "message":"I can edit the existing background, title, subtitle, panel, waveform, logo, border, spotlights, grain, and noise. I can move, show or hide, recolor, change opacity, resize, rotate, reorder, or reset them.",
  "suggestions":[
    "move_existing",
    "show_or_hide",
    "change_color",
    "change_opacity",
    "resize_or_rotate",
    "reorder_layers",
    "reset_scene"
  ]
}
```

A `help` response is informational only and has no `ops`.

---

## Reason codes

The model may use only these semantic reason codes. The controller still validates the response shape independently.

### Unsupported reasons

- `unknown_object` — the requested object is not in the authored registry;
- `new_object_creation` — the request asks to add or draw something not already present;
- `new_object_and_animation` — the request combines new-object creation with movement/flight/physics;
- `animation_or_physics` — the target exists, but the requested behavior is temporal or physical;
- `new_asset_or_drawing` — the request needs an image, illustration, arbitrary shape, or generated asset;
- `unsupported_text_edit` — the request asks to rewrite arbitrary title/subtitle copy in v0;
- `unsupported_property` — the object exists, but the requested property is not in its capability row;
- `unsupported_external_action` — the request targets audio, files, URLs, code, or browser behavior;
- `mixed_supported_and_unsupported` — the request contains a supported part and an unsupported part, so nothing is silently applied;
- `too_many_operations` — the request exceeds the five-operation bound;
- `conflicting_request` — the requested changes cannot be represented consistently.

### Clarification reasons

- `ambiguous_target`;
- `missing_target`;
- `missing_value`;
- `ambiguous_value`;
- `conflicting_request`;
- `mixed_request_needs_confirmation`.

The product should distinguish “I cannot do that” from “I can do that, but I need you to tell me which one.”

---

## Explicit unsupported examples

| User request | Required result | Why | Helpful direction |
|---|---|---|---|
| “Add a flying potato with a banana.” | `unsupported` | new objects plus animation are not in the registry or operation set | edit the existing title, panel, waveform, logo, spotlights, or layers |
| “Draw a cartoon astronaut beside the logo.” | `unsupported` | new artwork and new object creation | move, recolor, resize, or reorder the existing logo |
| “Make the title bounce every second.” | `unsupported` | animation is outside the static scene contract | rotate or move the title to one static position |
| “Rewrite the subtitle to say ‘Tonight only’.” | `unsupported` in v0 | arbitrary text editing is deliberately deferred | show/hide, move, recolor, or resize the existing subtitle |
| “Change the audio to a saxophone solo.” | `unsupported` | audio is not a scene property | edit the visible waveform/panel/spotlights |
| “Move the moon to the nearest corner.” | `unsupported` | `moon` is not an authored target; no nearest-object substitution | move an existing named object |
| “Make spotlight C amber.” | `unsupported` or `clarify` | C is not a target; if the user meant A/B, the model must ask rather than guess | choose spotlight A or B |
| “Hide the subtitle and add a flying potato.” | `unsupported` with no partial `ops` | silently dropping the potato request would misrepresent intent | ask the user to resubmit only the supported subtitle edit |
| “Move the title to the upper-left and hide the subtitle.” | `apply` | both are explicit legal operations | none needed |
| “Make everything look more dramatic.” | `clarify` | target and concrete properties are missing | ask which objects and whether to change color, opacity, scale, or position |

The exact wording can vary. The state transition cannot: unsupported requests must leave the scene unchanged.

---

## Browser/controller invariants

These are hard correctness rules, not suggestions.

1. **Strict parse.** Parse one JSON object only. Reject prose wrapped around JSON, Markdown fences, duplicate keys, unknown top-level fields, unknown operation names, and invalid value types.
2. **Schema validation.** Validate target IDs, capability membership, value ranges, operation count, and duplicate target/property writes.
3. **Atomic application.** Validate the entire `apply` plan before mutating the scene. One invalid operation means zero operations are committed.
4. **No browser inference.** The browser never resolves “the spotlight” to A, turns “add” into `show`, fills in missing coordinates, or selects a target from the user's original text.
5. **No browser repair.** The browser never fixes malformed JSON, renames an unknown target, clamps an invalid number into range, drops an unsupported operation, or converts a natural-language fallback into a command.
6. **No hidden fallback.** If the model emits malformed output, the controller reports a transport/protocol failure. It does not execute a deterministic guess and count that as Stagehand success.
7. **No partial apply.** A plan that contains both supported and unsupported intent is not reduced to its supported subset. The model must return `unsupported` or `clarify`.
8. **Preservation.** Every state property not named by an operation remains byte-for-byte/equivalent unchanged, subject only to the renderer's documented numeric normalization.
9. **Non-mutating responses.** `clarify`, `unsupported`, `noop`, and `help` never change scene state.
10. **Safe display.** Model messages are rendered as text. They cannot inject HTML, CSS, scripts, or controls.
11. **Truthful scoring.** A plan is scored against the resulting state and the response type. A useful refusal is a product success for an unsupported request, but it is not a scene-edit success.
12. **Explicit provenance.** Evaluation records whether the visible result came from a valid model plan, a controller error, or a test harness fallback. Fallback output cannot masquerade as adapter behavior.

---

## Operation coverage matrix

The matrix determines the data and the locked evaluation set. It is intentionally a coverage requirement, not a row-count estimate.

### Single-operation cells

Every legal operation family must be tested across its legal targets and value boundaries:

| Family | Required coverage |
|---|---|
| `move` | left/top edge, center, right/bottom edge, and representative interior positions |
| `visibility` | show an initially hidden object, hide an initially visible object, and no-op repeats |
| `color` | dark, light, warm, cool, and boundary-valid hex values |
| `opacity` | `0`, `1`, and interior values; grain/noise intensity behavior |
| `scale` | lower bound, authored default, upper bound, and interior values |
| `rotate` | negative, zero, positive, and angle boundaries |
| `layer` | front and back for each reorderable foreground family |
| `reset` | whole scene and representative per-object resets from altered states |

### Composition cells

The locked set must include combinations that are not exact copies of training plans:

- two properties on one target, such as show + recolor a spotlight;
- one property on two different targets;
- geometry + style, such as move title + recolor panel;
- visibility + layer ordering;
- three to five operations across at least three targets;
- the same operations in a different natural-language order;
- requests that change one property while preserving several other altered properties;
- requests whose final state is already partially modified;
- reset as a sole operation, never hidden inside a multi-operation plan.

### Language cells

For each semantic cell, use varied but model-visible-natural wording:

- direct commands;
- conversational requests;
- terse requests;
- polite requests;
- reordered clauses;
- synonyms such as “bring up” for showing an existing spotlight;
- upper-left/lower-right positional language;
- explicit colors and common color names;
- challenge wording with omissions, typos, and compact phrasing.

Split by scenario family and composition, not by adding fake IDs or audit markers to prompts.

### Boundary/refusal cells

The evaluation set must contain balanced examples of:

- supported apply;
- already-satisfied no-op;
- ambiguous target requiring clarification;
- missing value requiring clarification;
- unknown object;
- new object creation;
- animation/physics;
- new artwork or external asset;
- unsupported property on a known object;
- unsupported text editing;
- mixed supported and unsupported request;
- malformed model output.

Refusal and clarification are not “negative examples” to be hidden. They are part of the product contract and must be scored separately.

---

## Scoring rules

For every prompt, the evaluator records:

- response type correctness (`apply`, `clarify`, `unsupported`, `noop`, `help`);
- strict schema validity;
- operation validity;
- final scene-state correctness;
- preservation of unspecified properties;
- unsupported-boundary correctness;
- whether the response changed state when it should not;
- generated token count;
- latency and retries;
- raw model output;
- whether any fallback or repair was used.

### Apply score

An `apply` task passes only when:

1. every intended legal change is represented;
2. every emitted operation is legal and correctly valued;
3. the resulting scene matches the expected state within declared numeric tolerances;
4. unspecified properties are preserved;
5. no browser repair or fallback was used.

A short but incomplete plan fails. A visually plausible scene produced by browser inference fails.

### Unsupported score

An unsupported task passes only when:

1. the response type is `unsupported`;
2. no scene state changes;
3. the reason identifies the relevant boundary family;
4. the message does not claim the requested object/action was created;
5. at least one valid supported direction is offered when one exists.

Generic “I can’t help” without direction is not the desired product behavior, even if it avoids a bad edit.

### Clarification score

A clarification task passes only when:

1. the response type is `clarify`;
2. no scene state changes;
3. the question identifies the missing or ambiguous information;
4. the model does not choose a target or value on the user's behalf.

### Failure classes

Keep these separate in reports:

- parser/protocol failure;
- invalid operation;
- wrong legal operation;
- missing operation;
- property-preservation failure;
- unsupported request incorrectly applied;
- clarification incorrectly guessed;
- valid refusal with weak guidance;
- browser fallback/repair contamination;
- renderer/scorer defect.

This separation prevents a browser bug, a model failure, and a weak scorer from being collapsed into one accuracy number.

---

## User-facing capability copy

The stable capability summary should be short and concrete:

> I can edit the existing broadcast scene: move objects, show or hide them, change their colors or opacity, resize or rotate them, reorder the authored layers, and reset the scene. I work with the background, border, logo, title, subtitle, waveform, panel, two spotlights, grain, and noise. I cannot create new arbitrary objects, draw artwork, animate elements, or rewrite text in this first version.

For the example in the request, the desired response is equivalent to:

> I can’t add a flying potato with a banana because this scene only supports editing its existing elements, and it does not create or animate new objects. I can help move, show/hide, recolor, resize, rotate, reorder, or reset the existing broadcast elements. For example: “Bring up spotlight A in amber and move the title to the upper-left.”

The model may phrase this naturally, but the capability boundary and the absence of a scene mutation are non-negotiable.

---

## Deferred capabilities

These are deliberately not part of the first Stagehand canary:

- arbitrary text/content editing;
- adding from an asset catalog;
- deleting authored objects;
- relative pairwise ordering such as “put title behind panel”;
- non-uniform resize;
- animation timelines or transitions;
- user-authored shapes, illustrations, or imported images;
- multi-scene documents;
- read-only scene inspection questions;
- conditional logic, loops, and event handlers.

A deferred capability can be proposed later only after a measured failure or product need justifies expanding the contract. It must be added to the registry, schema, scorer, coverage matrix, and refusal set together.

---

## Release gate for this contract

Before any adapter training:

- the object registry and capability matrix are frozen;
- the strict response schema is implemented;
- the editor applies only canonical validated operations;
- the scorer verifies final state and preservation;
- unsupported and clarification paths leave state unchanged;
- a Stock-only canary measures apply, refusal, clarification, protocol, token, and browser-repair rates;
- no adapter is trained until the canary shows a meaningful task with headroom.

The number of training examples is earned from uncovered cells and observed failures after this contract is exercised. It is not chosen in advance.
