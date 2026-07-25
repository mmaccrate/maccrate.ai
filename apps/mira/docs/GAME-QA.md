# Mira Machine — Release Candidate QA

Date: 2026-07-16

## Product status

The current build is one continuous story-and-discovery slice rather than a campaign followed by an endless mode:

1. Percy’s route, Sayegh’s notes, Living Glass, and Mira’s self-edit can be explored in different orders.
2. Stable intermediate findings support longer chains; an old discovery combines with new evidence while the old pair never changes.
3. Percy’s return exposes the Passenger Signal and continues into The Voice in Glass, Percy’s Secret Archive, and Beyond the Mission Map without a mode switch.

Authored recipes own canonical truth, branch state, discoveries, and belief changes. The local model cannot invent or overwrite those facts.

## Local-model test architecture

`public/ollama-mira-test.js` is a localhost-only adapter activated with:

```text
http://127.0.0.1:4322/?ollama=1
```

Defaults:

```text
Ollama endpoint: http://127.0.0.1:11434
Model: gemma4:latest
```

Overrides are accepted only on localhost:

```text
?ollama=1&ollamaEndpoint=http%3A%2F%2F127.0.0.1%3A11434&ollamaModel=gemma4%3Alatest
```

This adapter is a behavioral test stand-in for browser WebGPU. It does not change the deployment architecture and is inert unless the localhost query flag is present.

The adapter and browser WebGPU hook use the same async frontier contract:

```js
window.__miraFrontier(a, b) => Promise<{ mira, question?, source }>
```

The story engine applies these rules:

- authored recipes and authored negative evidence always outrank generated interpretation;
- generated text can phrase a grounded relationship or useful absence;
- local generated text cannot alter authored anchor facts, open or resolve authored story threads, or invent mission history;
- a deterministic authored fallback is used if inference fails;
- each pair has one stable result for the game version, independent of story progress;
- evidence tuples constrain subjects, events, chronology, witnesses, and allowed facts before inference;
- generated output must pass deterministic length, vocabulary, support, and gap checks;
- a signed shared result outranks local generation; only a globally unknown pair invokes the result generator;
- the first valid unknown-pair result is written atomically and becomes exact for every later player;
- a cached local interpretation may update one allowlisted active hypothesis without changing the shared result;
- a visible typing state covers inference latency.

## Interaction semantics

### Investigation notebook

The notebook is part of the core loop, not optional interface polish:

- **Current question** states the mystery the player is actively trying to answer.
- **Current theory** summarizes Mira's bounded hypothesis in plain language.
- **Leads** offers two meaningful, untried pairings; the first advances the visible question and the second preserves exploratory play.
- Players can ignore the leads and combine any available fragments.
- **Local AI status** says only whether the model is loaded and how many discoveries it created in this run.
- Technical provenance labels never appear in the transcript.
- Fixed authored recipes anchor the world; every unrecognized pair requires local AI and must create a reusable finding that returns to inventory.
- With local AI unavailable, the game states that it is required instead of emitting generic story filler.

This layer prevents the evidence engine from degrading into blind pair exhaustion or an unreadable flat transcript. It must remain covered by `test:guided`.

### Conversation

- Mira uses neutral left-aligned bubbles.
- The player’s two taps appear as a cool-blue, right-aligned pair of evidence attachments. The game does not fabricate dialogue for the player and does not display a mechanical `Fragment + Fragment` receipt.
- System/setup text has no bubble.
- A thin gold edge is reserved for a major authored realization.
- Ordinary turns are one message. Major discoveries may use two timed messages when the second beat changes the emotional or narrative meaning.
- Generated interpretation and its follow-up question are combined into one response rather than always producing two bubbles.

### Fragments

Fragment colors do not encode undocumented categories. The functional states are:

- neutral: available;
- blue selection: the first fragment chosen;
- dimmed: every currently available pairing for that fragment has been tried;
- persistent `new` marker: newly discovered and not yet examined;
- brief gold edge: discovery arrival.
- when one fragment is selected, previously attempted partners carry a visible `TRIED` marker; `hide tried` filters only those partners.
- with no selection, `hide exhausted` hides only fragments with no remaining untried partner. Reusable findings are never hidden merely because they appeared in an earlier combination.

On mobile the fragment tray is a vertically scrolling two-column grid. It never requires horizontal scrolling. The tray header names the selected fragment and asks the player to choose one more.

## Automated full-game test

The final persistence/recovery gate is:

```bash
npm run test:release
```

It verifies saved-investigation recovery, a pending single-fragment selection, generated-finding reconstruction, stable reversed pairs without duplicate history, restart confirmation, sanitizer rejection, 44px controls, and 320px mobile bounds.

Run the game on port 4322, Ollama is reachable, then execute:

```bash
npm run test:game
npm run test:exploration
npm run test:registry
npm run test:guided
```

Optional endpoint override:

```bash
OLLAMA_ENDPOINT=http://127.0.0.1:11434 npm run test:game
```

The test performs:

- real UI clicks through the opening deduction;
- every authored recipe and all three stable multi-step chains;
- a real Gemma 4 frontier response through Ollama;
- repeat-pair cache verification before and after later story progress;
- single-flight registry behavior so only one browser generates an unknown global pair;
- three different opening exploration orders;
- retained player-attention state;
- specific authored evidence relationships such as chronology and rules-out;
- authored-evidence priority over the model;
- forbidden software-language checks;
- desktop and mobile playthroughs;
- 44px minimum artifact touch-target checks;
- horizontal and vertical page overflow checks;
- stable artifact order checks;
- hide-used behavior with and without a selection;
- branch resolution and continued-adventure assertions;
- corrupted local-state sanitation;
- 320px and reduced-motion accessibility checks;
- browser console and page-error checks;
- final desktop/mobile screenshots under `artifacts/qa/`.

Registry tests additionally cover canonical order-independent pair hashes, strict result schemas, source allowlists, injection rejection, browser verification of signed shared entries, automatic first-valid writes, duplicate handling, and repeat caching.

## Verified result

```text
QA PASS: complete authored chapters, Gemma 4 frontier, repeatable cache,
specific-evidence priority, filters, stable order, state sanitizer, desktop/mobile UI.
```

Model observed during QA:

```text
name: gemma4:latest
family: gemma4
parameter size: 8.5B
quantization: Q4_K_M
```

Observed frontier latency during iterative tests was approximately 1.3–1.5 seconds after the model was warm, with no API or JSON failures in the final run.

## Remaining platform-only gate

The product and AI behavior can be tested through Ollama in this environment. One deployment-specific gate remains and cannot be represented by Ollama:

- load the final Gemma 4 browser bundle in a GPU-backed HTTPS browser;
- confirm WebGPU buffer limits and kernel support on the target client GPU;
- run the same novel-pair, authored-priority, fallback, and cache checks against `window.__miraFrontier`;
- record first-load download time, warm inference latency, peak browser memory, and offline reload behavior.

That is a WebGPU runtime validation, not unfinished game design. The Ollama adapter must not ship as the production inference path.
