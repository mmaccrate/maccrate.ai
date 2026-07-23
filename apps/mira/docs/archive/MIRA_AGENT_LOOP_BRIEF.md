# Mira Agent Loop — Playable Slice Brief

## Goal
Turn the real AI-agent engineering loop into a fun sci-fi rover game without naming work context in the game.

## Pitch
Mira is a capable AI assistant trying to save the rover. She keeps making plausible wrong attempts. Watch her try, diagnose why she got stuck, give one concise correction, then run her again until the rover reaches the ridge.

## Player fantasy
“I’m pairing with a brilliant but stubborn AI. I don’t drive the rover; I debug Mira’s assumptions.”

## Core loop
1. Mira runs an attempt on the Mars board.
2. The rover fails visibly: stale map, wheel rut, dust fixation, or power overreach.
3. Player chooses one correction patch.
4. Mira updates her approach and tries again.
5. The next attempt changes physically on the board.

## Hidden agent-engineering metaphor
- Mira attempt = model/tool run.
- Correction patch = prompt/context steering.
- Stale map = stale context.
- Dust fixation = plausible wrong theory/tunnel vision.
- Wheel test = verification before proceeding.
- Short moves = smaller scoped iterations.
- Final success = clarified loop that actually works.

## Acceptance criteria
- One-screen Mars game, not dashboard.
- Immediate animated attempt in first interaction.
- Repeated turn loop with visible consequences.
- Player choices are diagnosis/correction, not clue trivia.
- Mira remains assistant/partner, not narrator.
- Shareable result: “Saved in N prompts / Mira was confidently wrong X times.”
