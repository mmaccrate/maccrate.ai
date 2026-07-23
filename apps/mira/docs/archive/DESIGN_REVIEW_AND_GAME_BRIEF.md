# What Happened to the Rover? — Design Brief

Date: 2026-06-30
Scope: Product reset for the standalone `maccrate-4096` artifact launched from the maccrate.ai portfolio stage.

## Current status

The previous implementation direction is rejected. `maccrate-4096` should no longer be treated as a 2048/4096 remake, Promptcraft, an agent terminal, a dashboard, or a jazz/instrument game.

This project remains a standalone app launched from the `maccrate-main` portfolio stage. The portfolio stage must be preserved and not redesigned as part of this game work.

## Locked decisions

- **Title:** What Happened to the Rover?
- **Assistant:** Mira
- **Mira personality:** slightly playful, warm, curious, and competent.
- **Tone:** eerie/playful Mars mystery — not dry NASA simulator, not horror, not AI-agent lecture.
- **Core premise:** the player is mission control on Earth, helping Mira understand why a Mars rover went silent.
- **First event:** the rover entered a crater shadow it should never have reached, then sent one impossible final image.
- **Core mechanic:** the player builds context packets from evidence fragments and asks Mira to reason from them.
- **Context size:** starts small and upgrades later, but more slots are not automatically better.
- **Key correction:** packet quality depends on *what evidence is selected*, not how many items are selected.

## One-sentence pitch

> A Mars mystery game where you build context packets from corrupted mission evidence and help Mira figure out what happened before the rover signal dies.

## Why this exists

The game should be fun as a mystery first. The AI-agent metaphor is inspiration for the mechanics, not public-facing homework.

Players should feel like they are solving a strange Mars incident with a clever assistant. Later, the project can support writing about AI-agent context management, but the game must not sacrifice quality or accessibility for that paper.

## Primary interaction

The repeated action is:

1. Inspect evidence fragments.
2. Choose a small context packet for Mira.
3. Ask Mira to analyze it.
4. Read how her theory changes.
5. Use contradictions and new leads to choose better context next time.
6. Submit the final chain of events before signal is lost.

This is not “combine any two things.” It is closer to building a useful prompt/context window for an AI assistant.

## Context packet rules

The context packet is the heart of the game.

A packet can contain several evidence fragments, eventually up to 4–5 items. However, the number of items is not the scoring model.

### Good packets

Good packets tend to:

- Include evidence relevant to Mira’s current question.
- Cover multiple useful systems, such as image + telemetry + terrain + command history.
- Include contradiction checks, not just supporting evidence.
- Remove stale or duplicated evidence.
- Help distinguish cause from coincidence.
- Let Mira explain a chain of events with fewer unsupported assumptions.

### Bad packets

Bad packets tend to:

- Repeat the same category too much.
- Include stale reports from the wrong sol.
- Mix unrelated events.
- Over-focus on a tempting theory.
- Leave out the verification evidence needed to test that theory.
- Cause Mira to drift into a plausible but wrong explanation.

### Important principle

A 5-item packet can be excellent if every piece earns its place.
A 2-item packet can be terrible if both pieces are misleading.

The player is not trying to send “the most clues.” The player is trying to send the smallest useful set of evidence that lets Mira reason without guessing or drifting.

## Progress model

Do not use a simple “72% correct” progress bar.

Progress should be shown through Mira’s evolving case theory:

- Mira asks sharper questions.
- Contradictions appear and later get resolved.
- New evidence unlocks.
- Unsupported assumptions decrease.
- The theory becomes more specific.
- The final chain becomes submit-ready.

Mira can still be confidently wrong if the player feeds her noisy or biased context. That should be part of the mystery.

## Hallucination / drift model

Bad context should not always announce itself as bad.

Sometimes Mira should produce a plausible theory that later fails against new evidence. This creates the right feeling:

> “Mira sounds confident, but this does not explain the final image.”

This maps to the AI-agent inspiration without saying it directly on screen.

Soft failure signals can include:

- Mira over-repeating one hypothesis.
- Contradictions piling up.
- New leads narrowing too early.
- Signal being wasted on unsupported theories.
- The player realizing a prior packet was biased or stale.

## First case outline

### Surface mystery

The rover went quiet after a dust event near a crater.

### Hook

Its final image appears to show a crater shadow location it should never have reached.

### Deeper truth candidate

The rover did not simply lose power from dust. A corrupted or stale route/memory state caused it to follow an old path, drift toward hazardous terrain, jam or strain a wheel, and enter shadow. The final image exposes a contradiction in the official route narrative.

This can change during implementation, but the first playable slice should support this style of mystery: realistic systems cause plus eerie impossible clue.

## Evidence fragment examples

The first prototype should use a small, hand-authored set — roughly 12–16 fragments.

Possible fragments:

- Final navcam image
- Cropped shadow anomaly
- Solar output graph
- Wheel current spike
- Route command log
- Stale route cache
- Terrain slope map
- Dust forecast
- Dust report from wrong sol
- Battery thermal reading
- Rover clock drift
- Memory checksum warning
- Last antenna handshake
- Prior crater survey image
- Official incident summary
- Mira’s current hypothesis note

Fragments should be short and tactile. They should feel like pieces of a case, not paragraphs in boxes.

## Prototype scope

The first playable slice should include only one case.

Minimum prototype:

- One intro screen / title hook.
- Evidence archive with 12–16 fragments.
- Context packet area with 3 initial slots.
- “Ask Mira” action.
- Mira theory panel that updates based on packet quality.
- A few strong packet combinations that unlock new evidence or theory steps.
- A few misleading packet combinations that produce plausible drift.
- Final solve action where the player chooses or assembles the chain of events.
- End state: solved, unresolved, or wrong-but-plausible.

Do not build multiple cases yet.
Do not build upgrades beyond what the first case needs.
Do not add dashboards, charts, fake logs, or coding-agent labels.

## Interface direction

The previous interaction screen was rejected by user feedback: it looked like AI business dashboard buttons, boxes, tabs, and productivity software. The interaction screen must be reworked as an exploratory Mars scene.

Corrected layout:

- Keep the title screen direction; it works.
- After opening the case, show a large tactile Mars/crater scene, not three dashboard columns.
- Evidence appears as hotspots embedded in the scene: rover, crater shadow, glint, wheel marks, dust cloud, planned route, ghost route, ping, cache.
- The player’s repeated action is exploration: tap scene objects, inspect a short clue card, add the clue to a small three-clue packet, then send it to Mira.
- Text must be short. No paragraphs in grids. No archive panels full of cards.
- Mira should be an atmospheric companion bubble, not a side-panel report.
- Progress should feel like a case thread across the bottom, not tabs or a product workflow.
- Signal/time pressure should be a small diegetic HUD element.

Explicit removals:

- Remove dashboard columns.
- Remove big evidence archive lists.
- Remove visible “tabs,” business-card grids, or generic empty slots as the primary visual.
- Remove heavy reading as the main action.
- Avoid any screen that can be mistaken for AI productivity software.

## AI-agent metaphor mapping

Keep this mostly invisible to players.

- Evidence fragments = files, logs, screenshots, search results, tool output.
- Context packet = prompt/context window.
- Stale evidence = stale files or obsolete assumptions.
- Repeated evidence category = over-grepping one file or tunnel vision.
- Contradiction checks = tests, visual QA, failing assumptions.
- Mira’s evolving theory = agent plan/explanation.
- Signal loss = limited attention/token/time budget.
- Context upgrade = ability to manage more complex work, not permission to dump everything.

Do not put this mapping as a lecture in the game. It belongs in later writing.

## Acceptance criteria before coding

Before replacing the current implementation, confirm the prototype can satisfy:

- A stranger understands the core action in under 5 seconds.
- The primary interaction is building and submitting context packets.
- Mira’s responses create curiosity, not homework.
- Packet quality depends on relevance and contradictions, not item count.
- The first case has a real mystery payoff.
- The app feels shareable as a game, not an AI productivity demo.
- The UI is not a dashboard, terminal simulator, or side-panel lecture.
- `maccrate-main` remains untouched.

## Verification plan for implementation pass

When coding begins, verify with real tools:

- `git status --short` before editing.
- Build with `npm run build`.
- Run dev server and test in browser.
- Exercise the actual loop: select evidence, fill packet, ask Mira, unlock/shift theory, submit ending.
- Use screenshot/visual QA on desktop and mobile-sized viewport.
- Confirm no rejected copy appears: Promptcraft, Agent Terminal, jazz/instrument gameplay, 2048 assumptions.
- Commit only after functional and visual verification.

## Process controls

1. **Brief before code**
   - Product direction must be written before implementation changes.

2. **No unsolicited broad rebuilds**
   - Replace the rejected implementation only after this brief is accepted or the user asks to proceed.

3. **One coherent slice first**
   - Build one case well before adding multiple events, upgrades, lore, or systems.

4. **Game first**
   - The white paper/AI-agent analysis is downstream. The player-facing artifact must stand on its own.

5. **Memory of resolved feedback**
   - Do not re-litigate resolved decisions: title, Mira, tone, no 2048 assumption, no Promptcraft, no dashboard/terminal slop, packet quality is about selected evidence rather than number selected.
