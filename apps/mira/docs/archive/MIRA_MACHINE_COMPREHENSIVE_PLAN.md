# MIRA MACHINE — Comprehensive Game Plan

## Status
This is the current north-star plan for `maccrate-4096` after rejecting earlier loops that felt like evidence editing, text correction panels, route arrows, dashboards, or weak metaphors.

The larger vision matters more than a quick prototype. The goal is not to make a generic dark AI website with rounded cards. The goal is a memorable, playful, visually distinctive game about teaching an AI assistant what Mars means.

---

## One-sentence pitch
Combine strange Mars artifacts, feed discoveries to Mira, and watch Percy’s rover mystery change until Mira finally understands how to bring Percy and the blue sample home.

Shorter tagline options:
- Teach Mira what Mars means.
- Combine Mars clues. Feed Mira. Watch Percy change.
- Every discovery changes what Mira does next.
- Help Mira stop solving the wrong Mars.

---

## The core fantasy
Percy is missing on Mars.
Mira is an AI assistant who wants to help, but she does not understand the world correctly yet.

The player is not chatting with Mira.
The player is not picking correction buttons.
The player is not editing evidence.

The player discovers meaning by combining physical Mars objects, then gives those discoveries to Mira. Mira interprets them, acts through Percy, and the Mars diorama changes.

The exciting moment is:
“I combined two things, Mira saw the world differently, and Percy did something new.”

---

## Why this is different from previous failed directions
Rejected patterns:
- evidence/tape editing
- text-button corrections
- route arrows
- dashboard/log panels
- clue trays
- generic arcade pasted under AI copy
- forced rush timers
- “AI context” exposed as UI labels
- more explanatory copy pretending to be gameplay

This plan avoids those by making the interaction physical and consequential:
- combine artifacts, not labels
- feed Mira discoveries, not answers
- watch Mars change, not read a report
- story emerges from animation, not paragraphs
- AI generation expands discoveries, but deterministic rules preserve game feel

---

## Inspiration patterns

### Infinite Craft
Important lesson: combinations become canonical.
The first time a combination is discovered, AI may generate it. After that, the result is saved and deterministic for everyone.

Transfer:
- `Last Signal + Rover Tracks = Ghost Trail`
- Once created, that result is canon.
- Players learn the world rather than pulling a slot machine.

### Little Alchemy
Drag two things together, get a new thing, grow the palette.

Transfer:
- discovering new Mars artifacts grows the possibility space.
- the palette is playful, not a database table.

### Baba Is You
Rules are physical objects that change the world.

Transfer:
- discovered artifacts change Mira’s interpretation of Mars.
- “Echo Beacon” is not just a word; it changes how Mira treats signals.

### Opus Magnum / ECHOS
Build, run, watch the machine succeed or fail. The animated run is satisfying and shareable.

Transfer:
- after feeding Mira a discovery, Percy acts it out.
- the final rescue should be a beautiful replayable animation.

### Outer Wilds / Journey / ABZÛ
Mystery and progress are environmental. The world is the feedback.

Transfer:
- Mars should visibly transform: ghost paths, glowing sample, looping tracks, safe shadow, ridge home.
- the board becomes the story.

---

## Core game loop

1. Player sees Mars diorama and a few tangible artifacts.
2. Player combines two artifacts.
3. A new discovery appears.
4. Player gives the discovery to Mira.
5. Mira reacts briefly and runs it through Percy.
6. Percy acts in the Mars scene.
7. The scene changes and may reveal a new artifact.
8. Player continues combining toward rescue.

The player should always understand the next available action:
- combine two objects
- give new discovery to Mira
- watch what happens

No form inputs. No text prompts. No menus of correction options.

---

## Interaction model

### Desktop
- Artifacts are tactile objects floating/placed around the Mars scene.
- Drag artifact A onto artifact B to combine.
- New artifact pops out with a satisfying pulse.
- Drag/flick/tap the new artifact into Mira’s glowing core to run it.
- Click-combine fallback: click A, click B.

### Mobile
Precision drag cannot be required.
- Tap artifact A.
- Tap artifact B.
- They combine.
- Tap the new artifact or Mira to feed it.

Mobile must feel native and fast, not like manipulating tiny cards.

### Visual feedback
- selected artifact glows and lifts
- valid combine target magnetizes
- invalid pair gives a soft “not yet” pulse, not an error popup
- new discovery has a birth animation
- feeding Mira triggers a clear scene animation

---

## The first 10 seconds

Opening image:
A handcrafted Mars diorama, not a dashboard.

Visible:
- Percy’s last tracks looping near a crater
- a faint blue sample glow
- a strange reflected beacon in Mirror Rock
- Ridge Home far away
- Mira as a small luminous orb/core, waiting

Mira says one short line:
“I can save Percy. Show me what Mars means.”

Starting artifacts:
- Last Signal
- Rover Tracks
- Blue Sample
- Mirror Rock

First intended interaction:
`Last Signal + Rover Tracks = Ghost Trail`

Give Ghost Trail to Mira:
- tracks light up in a loop
- Percy’s path replays three times around the same crater
- Mira: “The signal repeats. Percy wasn’t lost — he was looping.”
- Mirror Rock pulses, inviting the next combination

This teaches the game without an instruction paragraph.

---

## Core authored story path
The base game must be winnable without WebGPU or live AI.

### Starting artifacts
- Last Signal
- Rover Tracks
- Blue Sample
- Mirror Rock

### Early discoveries
1. Last Signal + Rover Tracks → Ghost Trail
   - Feed to Mira: Percy’s loop appears.

2. Ghost Trail + Mirror Rock → Echo Beacon
   - Feed to Mira: fake beacon is revealed as a reflection.

3. Blue Sample + Rover Tracks → Percy Carried It
   - Feed to Mira: Percy refuses paths that abandon the sample.

4. Echo Beacon + Percy Carried It → True Mission
   - Feed to Mira: Mira understands “save Percy” is incomplete; Percy is protecting the sample.

### Midgame discoveries
5. True Mission + Ridge Home → Bring Both Home
   - Feed to Mira: home path changes to include sample.

6. Singing Wheel + Rover Tracks → Wheel Warning
   - Feed to Mira: Percy limps; wheel vibration appears before failure.

7. Wheel Warning + Soft Sand → Careful Step
   - Feed to Mira: rover avoids high-strain terrain.

8. Solar Flare + Shadow Canyon → Safe Shadow
   - Feed to Mira: the scary blue shadow becomes shelter.

9. Echo Beacon + Filtered Signal → Clean Signal
   - Feed to Mira: fake path dims; true ridge pulse appears.

10. Careful Step + Safe Shadow → Ridge Crossing
    - Feed to Mira: Percy crosses the dangerous zone.

### Final chain
11. Clean Signal + Bring Both Home → Home Instruction
12. Home Instruction + Ridge Crossing → Percy Comes Home

Final animation:
- ghost beacon fades
- Percy carries the blue sample through safe shadow
- wheel trembles but holds
- Ridge Home lights up
- Mira’s core changes from flickering blue to warm gold

Final Mira line:
“I was solving the wrong mission. Percy was protecting the sample.”

---

## Side discoveries
Side discoveries are important for curiosity and replayability.
They should not block the main path.

Examples:
- Blue Sample + Mirror Rock → Prism Sample
- Ghost Trail + Blue Sample → Singing Rock
- Last Signal + Mirror Rock → Reflected Call
- Percy Carried It + Mirror Rock → Twin Percy
- Singing Wheel + Echo Beacon → Humming Canyon
- Solar Flare + Blue Sample → Charged Glass
- Soft Sand + Rover Tracks → Sinking Pattern
- Clean Signal + Mirror Rock → Beacon Lens

Each side discovery should do at least one of:
- add a visual flourish to Mars
- reveal optional lore
- unlock a cosmetic artifact
- create a funny Mira reaction
- become useful in an alternate ending

No dead “word only” discoveries if possible.

---

## WebGPU / AI expansion vision
The WebGPU/local AI layer is for endless exploration, not for the core rescue path.

### Principle
AI can create first-time unknown discoveries, but saved results become canonical.

Combination flow:
1. Normalize pair: sort IDs, include game version.
2. Check local cache.
3. Check shared canonical cache.
4. If found, return deterministic saved result.
5. If unknown and local WebGPU AI is available, ask local model to propose result.
6. Validate output against schema.
7. Save result locally.
8. Optionally submit to shared cache with consent.
9. Future users receive the same result for that combo.

This is the Infinite Craft model.

### Why local WebGPU helps
- no public exposed LLM endpoint
- user’s machine runs inference
- privacy-preserving by default
- technically impressive
- supports “endless frontier” combinations

### Why WebGPU cannot be required
- not all devices support it
- model download can be large
- mobile performance varies
- first load may be slow
- output quality may vary

Therefore:
- core game is authored and works for everyone
- WebGPU mode is optional “Frontier Mode”
- non-WebGPU users can still use shared cached discoveries

---

## Result schema for AI-generated discoveries
The model must not return arbitrary prose blobs.
It returns strict structured data.

```json
{
  "name": "Echo Wall",
  "type": "signal | terrain | rover_behavior | sample | tool | memory | route | anomaly | ending_fragment",
  "mira_line": "That wall is my own signal coming back.",
  "scene_effect": "double_blue_ring",
  "short_lore": "Percy was not chasing a beacon. He was chasing a reflection.",
  "unlocks": ["Echo Filter"],
  "tags": ["ghost", "signal", "reflection"]
}
```

Validation rules:
- name under 24 characters
- Mira line under 90 characters
- lore under 160 characters
- type must be from allowed list
- scene effect must map to known visual templates
- unlocks must be validated or mapped to a generic artifact type
- no raw HTML
- no user-supplied prompt text appears directly
- no off-theme modern/pop-culture junk in canonical shared cache

---

## Cache / database model

Canonical combo key:
```text
hash(game_version + sorted_artifact_ids)
```

Record:
```json
{
  "combo_hash": "abc123",
  "game_version": "mira-machine-0.1",
  "inputs": ["last_signal", "rover_tracks"],
  "result_id": "ghost_trail",
  "result_name": "Ghost Trail",
  "type": "route",
  "mira_line": "The signal repeats. Percy was looping.",
  "scene_effect": "track_loop_replay",
  "source": "authored | local_webgpu | shared_cache | curated",
  "created_at": "...",
  "approved": true,
  "votes": 0
}
```

Important:
- authored core path is always approved
- local AI results are local-first
- shared results can be moderated/curated
- repeated combinations are deterministic

---

## Preventing stuck states and endless loops

### Problem: player cannot find next combo
Solutions:
- Scene glow hints after idle time: relevant artifacts subtly pulse.
- Mira can “wonder” about two objects without saying the answer.
- Discovered artifacts cluster near related Mars features.
- Failed combos are remembered visually, so players do not repeat them accidentally.
- A “constellation” view can show discovered relationships as faint lines, not a dashboard.

### Problem: player creates endless side discoveries but misses goal
Solutions:
- Keep Ridge Home / Percy / Blue Sample visible as constant visual goal.
- Story-critical artifacts have slightly warmer/golder glow.
- Every few side discoveries, Mira reacts with a goal reminder tied to the scene.
- Optional “Mira focus” action highlights artifacts connected to rescue path.

### Problem: AI-generated results pollute progression
Solutions:
- AI frontier results cannot unlock critical path unless curated.
- Core rescue path remains authored.
- AI results can unlock side artifacts, cosmetics, alternate lore, or rare endings.
- Unknown AI artifacts map to known mechanical types before affecting simulation.

### Problem: too many objects clutter the screen
Solutions:
- Artifacts live as physical constellation pieces around Mars, not boxes in a tray.
- Recently useful artifacts stay near Mira.
- Older side discoveries fold into a “discovery sky”/orbit ring.
- Search/filter can exist later, but not in the first prototype.

### Problem: invalid combinations feel bad
Solutions:
- Avoid harsh “invalid” errors.
- If no result exists, show a soft physical response: sparks fade, Mira shakes head, objects drift apart.
- In WebGPU/frontier mode, unknown pairs can become discoveries.
- In base mode, invalid pairs can still produce tiny visual echoes, but not new objects.

### Problem: deterministic database makes first discoverer’s bad AI result permanent
Solutions:
- Shared cache has approval tiers.
- Local result is immediate for that player.
- Public canonical result requires validation and/or moderation.
- If a result is later improved, aliases can preserve old local history while canonical public result updates.

### Problem: people without WebGPU feel limited
Solutions:
- authored campaign is complete and satisfying
- shared cache supplies many discovered combos
- offline fallback has curated side discoveries
- WebGPU is framed as “Frontier Mode,” not “real mode”

---

## Art direction
Avoid generic AI SaaS aesthetics.

No:
- generic dark gradient landing page
- rounded dashboard cards everywhere
- fake terminal/log panels
- admin UI
- neon-blue corporate AI look
- tiny text-heavy boxes
- sterile “chatbot interface” language

Yes:
- tactile Mars diorama
- warm rust, blue glass, bone-white rover tracks, gold Mira core
- artifacts feel like found objects, not buttons
- scene has depth: ridge, canyon, mirror rock, sample glow, dust/sand layers
- Mira feels like a small living instrument/orb, not a chatbot box
- UI feels like a toy table / magic workbench / rover control altar
- motion matters: pulses, echoes, tracks, sample glow, route replay

Visual palette:
- Mars rust: `#b85f35`, `#7a321f`
- deep night: `#09070d`, `#17101a`
- sample blue: `#73d9ff`, `#2e8cff`
- Mira gold: `#f4bd6f`, `#ffe1a0`
- ghost cyan: `#9ff4ff`
- shadow violet: `#34275f`

Texture language:
- sand grain
- glassy blue sample refraction
- glowing signal rings
- chalky rover tracks
- brass/gold Mira core
- hand-drawn circuit lines or carved grooves

The page should feel handcrafted and story-rich, not like an AI product demo.

---

## Sound direction (optional later)
Sound can make this dramatically more satisfying.

Small effects:
- artifact pickup: soft mineral chime
- combine success: resonant pulse
- invalid combine: sand puff / dull knock
- feed Mira: rising harmonic
- Percy run: tiny motor + track crunch
- ghost signal: reversed radio tone
- final rescue: warm chord

No constant generic ambient music unless it is excellent.

---

## First prototype scope
Build only enough to prove the core delight.

Must include:
- Mars diorama
- Mira core
- 4 starting artifacts
- combine interaction
- feed-to-Mira interaction
- 4–6 authored discoveries
- scene animations for each fed discovery
- final rescue animation
- localStorage cache for discovered combos
- deterministic result map
- mobile tap flow

Do not include yet:
- WebGPU model loading
- account system
- public database
- moderation UI
- huge discovery graph
- generic score screen
- long intro/lore

Prototype success test:
A player should want to try at least one more combination after the first discovery.

---

## First prototype authored sequence

Starting artifacts:
1. Last Signal
2. Rover Tracks
3. Blue Sample
4. Mirror Rock

Recipes:
1. Last Signal + Rover Tracks → Ghost Trail
2. Ghost Trail + Mirror Rock → Echo Beacon
3. Blue Sample + Rover Tracks → Percy Carried It
4. Echo Beacon + Percy Carried It → True Mission
5. True Mission + Mirror Rock → Clean Signal
6. Clean Signal + Blue Sample → Percy Comes Home

Scene effects:
- Ghost Trail: track loop lights up around crater
- Echo Beacon: fake beacon appears as reflected ring
- Percy Carried It: tiny rover ghost refuses to leave sample
- True Mission: Mira core changes color; goal line shifts from “save rover” to “bring both home”
- Clean Signal: false path dims; ridge path glows
- Percy Comes Home: final rover animation

This sequence is intentionally small but emotionally coherent.

---

## WebGPU / Frontier Mode prototype later
After the authored loop feels good:

Add:
- WebGPU capability detection
- optional “Wake local Mira” button
- model loading progress as in-world ritual, not a blocking tech screen
- strict JSON generation for unknown combos
- local cache of generated combos
- fallback to shared/static cache when unavailable

Frontier Mode copy:
“Local Mira can dream up new Mars discoveries on your device.”

Do not say:
“Download model / inference / WebGPU kernels” in the main game flow.
Technical notes can live behind an info button.

---

## Open questions
1. Is the title “Mira Machine” strong enough, or should the title stay closer to Percy/Mars?
2. Should feeding Mira be done by dragging into the orb, tapping Mira, or a single central “run” gesture?
3. Should artifacts be represented as icons with short names, or mostly visual objects with names only on hover/tap?
4. How visible should the discovery graph be?
5. Should WebGPU-generated discoveries be private by default with opt-in sharing?

---

## Current recommendation
Build the first authored vertical slice next.

Not because it is the final game, but because it tests the essential question:

Is combining Mars artifacts and feeding discoveries to Mira fun enough that the player wants to see what happens next?

If yes, then WebGPU/Infinite Craft expansion becomes worth building.
If no, no amount of local AI will save it.
