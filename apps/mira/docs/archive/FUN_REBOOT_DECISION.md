# What Happened to the Rover? — Fun Reboot Decision

Date: 2026-07-03
Scope: `maccrate-4096` only. Do not touch `maccrate-main`.

## Honest diagnosis

The evidence-click mystery loop is dead. The user is not objecting to copy, layout, or clue names anymore; they are objecting to the core verb.

Current bad verb:

> Read a prompt → click labeled thing → read response → click next thing.

That will keep feeling random and boring no matter how much the UI is polished.

## Non-negotiable metaphor

The game still needs the AI-assistant/context-management metaphor.

Mira cannot be just a narrator. Mira should be an active assistant who helps manage context while the player deals with the rover problem. The gameplay should make context feel like something the assistant filters, compresses, prioritizes, and sometimes gets wrong when stale information dominates.

So the reboot cannot become a generic Mars arcade game. The tactile verb must embody:

- relevance: which signals matter right now,
- recency: fresh context beats stale cache,
- diversity: different signal types stabilize Mira's model,
- contradiction: world evidence can override the official report,
- drift: stale context pulls the rover or assistant toward the wrong action.

## New requirement

The game needs a tactile verb first, narrative second.

The player should be doing something physically understandable before reading anything:

- steering,
- dragging,
- dodging,
- balancing,
- repairing,
- matching under pressure,
- racing a decay timer.

The Mars mystery and AI metaphor should become the reward/payoff for play, not paragraphs the player must read before anything is fun.

## Recommended direction: Mira Co-Pilot / Shadow Chase

### One-sentence pitch

A tiny arcade co-pilot game where the rover is being pulled along a stale autopilot route toward crater shadow, while Mira helps manage live context; the player steers, grabs fresh signals, and feeds Mira enough relevant context to override the bad cache.

### Primary interaction

- Player holds/drag/swipes to steer the rover.
- A ghost route constantly pulls the rover toward the old cached path.
- Mira maintains a small live context buffer automatically.
- Signal pickups are physical objects in the scene, not text clues.
- Different pickup colors mean different context types:
  - sun/power = energy context,
  - wheel/terrain = route context,
  - camera/image = contradiction context,
  - cache fragments = dangerous stale context.
- The player chooses what to collect by steering, not by reading cards.
- Mira reacts with short barks and changes the assistance she gives.

### What Mira actually does

Mira is the AI assistant managing context in real time:

1. She watches what the player collects.
2. She keeps a tiny visible context stack: three glyph chips, not reading cards.
3. Relevant/diverse/fresh context weakens the ghost-route pull.
4. Too much stale cache strengthens the bad autopilot pull.
5. Contradiction context lets Mira shout a useful route correction: “Shadow mismatch — cut left!”
6. At the end, Mira compresses the run into the reconstruction.

The player feels context management because the rover literally drives better or worse depending on what context Mira has.

### Why this is more fun

- Immediate physical goal: keep rover in sunlight.
- Constant tension: ghost route pulls against the player.
- Skill expression: dodge shadow/ruts, grab useful context, avoid stale fragments.
- AI metaphor is mechanical: Mira's context buffer affects control and drift.
- Story is discovered through action: the player feels stale cache causing failure before Mira explains it.
- No random clue clicking.
- No transmit button.
- No reading walls.

### Minimal UI

- Rover in a Mars top-down scene.
- Battery bar.
- Packet integrity / time.
- Mira context stack with 3 small glyphs.
- One-line Mira barks only.
- End-of-run reconstruction after play.

### Game loop

1. Tap Start.
2. Rover begins moving along terrain.
3. Player drags to steer.
4. Ghost route tugs toward crater shadow.
5. Player stays in sun, dodges ruts, and collects useful signal fragments.
6. Mira's context stack updates automatically.
7. Better context reduces drift and reveals safer route arrows.
8. Too much stale context increases drift.
9. Survive long enough / collect enough relevant context to reconstruct the cause.
10. Quick end screen shows: stale cache → drift → rut → shadow.

### AI/context metaphor underneath

- Stale cache = ghost autopilot route tugging the rover wrong.
- Fresh relevant context = pickups that let Mira correct steering.
- Diversity = multiple context colors stabilize the route better than duplicates.
- Contradiction check = image/sun mismatch pickup that overrides the official dust explanation.
- Bad context = drift into shadow.
- Context window = Mira's 3-chip stack; old chips fall out automatically.

## Other viable options

### Option B — Route Drawing Puzzle with Mira Context

Player draws a route, Mira auto-selects context chips to predict risk, then the rover executes. More puzzly, less arcade. Safer, but still risks feeling cerebral.

### Option C — Rover Repair Toy with Context Buffer

Player physically reconnects modules/cables to keep Mira's context window coherent while decoding the packet. More tactile, but less connected to route/shadow.

### Option D — Radar Sweep with Context Triangulation

Player sweeps a scanner to find signal fragments. Mira builds a context stack from finds. More atmospheric, but risks becoming another hidden-object clicker.

## Recommendation

Build a small Mira Co-Pilot / Shadow Chase prototype next, not another clue/replay/click mystery.

Acceptance criteria for the prototype:

- A player can understand the first action without reading more than one line.
- Player is steering/dragging within 3 seconds.
- Mira's context stack visibly changes gameplay, not just text.
- Wrong play causes visible physical consequence, not text feedback.
- Mira text is short barks, not instruction paragraphs.
- A 30-second playthrough has tension even if the user ignores the story.
