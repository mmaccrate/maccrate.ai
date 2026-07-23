# Mira Machine — Ship Definition

Mira Machine is a mobile-first Mars mystery inspired by Infinite Craft. The player pairs recovered evidence; each pair creates a discovery, rules something out, recalls a character moment, or changes Mira’s interpretation. The conversation is the game.

## Locked interaction

- Two taps remain the complete action.
- The chat shows the two submitted evidence cards, not fabricated player dialogue and not “You connected X + Y.”
- Mira responds after a typing beat.
- Authored discoveries establish reality; local Gemma interprets unexplored relationships using current evidence and prior investigation history.

## Publishable slice

- Percy’s Choice and Passenger Signal are complete.
- Every plausible pair gives specific investigative value.
- Repeating a pair is stable until new evidence changes its context; Mira can then reconsider it.
- The game remembers which subjects the player explores and passes that attention to local Gemma.
- New evidence stays visibly new until examined and is brought into view.
- No dashboard, recipe hints, scores, generated noun spam, or unrestricted lore generation.

## Release gate

Build, complete story test, real Ollama frontier test, mobile/desktop visual QA, accessibility checks, and physical-GPU WebGPU validation. Ollama remains test-only; production inference remains browser WebGPU.