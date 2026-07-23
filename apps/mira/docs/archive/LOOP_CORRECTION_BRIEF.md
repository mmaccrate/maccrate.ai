# What Happened to the Rover? — Loop Correction Brief

Date: 2026-07-03
Scope: Standalone `maccrate-4096` only. Do not touch `maccrate-main`.

## User feedback being fixed

The current game loop feels confusing, uncomfortable, and unentertaining:
- Clicking clues causes a jarring full-screen takeover.
- The UI reads like AI nonsense / boxes inside boxes.
- Feedback after selecting clues does not explain what the player learned.
- Random exploration punishes the player by draining signal, which makes the loop feel hostile instead of intriguing.

## One-sentence pitch

Explore a Mars crash scene, pin evidence to Mira's radio tray, and solve three clear mystery questions without the interface swallowing the screen.

## Primary interaction

1. Tap visible objects in the Mars scene.
2. A compact inspection card appears in-scene / docked, not as a full-screen modal.
3. Tap `Pin for Mira` to add the clue to the radio tray.
4. When the current question has enough useful clues, `Transmit` becomes a confident action.
5. Mira explains exactly what changed, unlocks the next scene detail, and advances to the next question.

## Minimum UI

Keep:
- Title screen and Mars mystery premise.
- Large visual crater scene.
- Mira as companion voice.
- Small radio tray.
- Small signal HUD.

Remove / reduce:
- Full-screen clue modal takeover.
- Generic empty slot boxes as the dominant object.
- Punishing signal loss for exploratory clicking.
- Ambiguous recipe feedback.
- Dashboard/productivity language.

## New loop rules

- Exploring clues is free and should feel safe.
- Signal only drops when the player transmits a packet that does not answer Mira's current question.
- Wrong packets get specific coaching: what is missing and why.
- The current question is always visible in Mira's short line.
- Packet size can be 2–3 clues depending on the stage; quality is about relevance and contradiction, not filling arbitrary boxes.
- The solve button stays hidden until the final chain is proven.

## Three-beat case arc

1. **Dust story breaks** — final image + solar drop + dust report prove the official dust-only story is too neat.
2. **Rover kept moving** — route stop + wheel marks + rut prove the rover went past the planned endpoint.
3. **Ghost route wakes** — cache + checksum + clock prove stale navigation replayed an old path.

## Why a human would play

The delight should be: "I tapped the scene, noticed a contradiction, sent the right evidence to Mira, and the landscape changed because we understood something." Each stage should create a small aha, not a form submission.

## Acceptance criteria

- No clue interaction opens a full-screen modal.
- A first-time player can see the current goal in under 5 seconds.
- Clicking scene objects gives short, tactile feedback.
- Wrong packets explain the missing link without nonsense.
- Random clue inspection does not lower signal.
- Visual read is exploratory Mars scene, not dashboard or AI productivity UI.
- `npm run build` passes.
- Browser QA exercises intro, clue inspection, wrong transmit, full good path, solve, and mobile layout.
