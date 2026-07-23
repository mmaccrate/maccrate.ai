# Narrative Design v2 — Event Structure, Mira Voice, and Game Content Updates

## Design Goals

1. **Multiple event beats** — The single "final image" mystery becomes a three-event chain: event A (the shadow), event B (the signal), event C (the contradiction). Each event has its own mini-mystery that contributes to the whole.
2. **Playability of the first case** — The first case is complete and satisfying on its own. It has a clear mystery, a believable path through evidence, and a payoff that rewards good reasoning.
3. **Mira voice polish** — More personality, less clinical. Mira sounds warm, slightly playful, and genuinely invested in the puzzle. No lecture-speak.
4. **Mystery payoff** — The reveal sequence is structured so the player "gets it" at the right moment, with evidence clicks into place.
5. **Theory state clarity** — Theory states tell the player where they are in the reasoning process. They are distinct and meaningful.

---

## Event Chain Structure (Three-Event Arc)

### Event A — "The Wrong Turn" (Initial Discovery)
- **What the player sees first:** The rover went off its planned route into a crater shadow it should never reach.
- **Surface clue:** Final navcam shows a shadow angle that doesn't match the official terrain.
- **What Mira guesses initially:** Dust storm ate the signal. Plausible, official, slightly wrong.
- **Key evidence that triggers the contradiction:** `final-image` + `shadow-crop` + `solar`
- **What the contradiction reveals:** The shadow geometry says the rover is *inside* or *below* the planned path, not on it.
- **Mystery beat:** If the rover was on the official route, it would not be in that shadow position. The route didn't just fail — something extended it.

### Event B — "The Ghost Signal" (Signal Anomaly)
- **What the player discovers:** An old command from the antenna handshake overlaps with the last wheel event.
- **Surface clue:** The rover was alive *after* it should have been dead, and communicating in a way that suggests a repeat loop.
- **What Mira guesses initially:** The antenna reconnected briefly. Normal comms retry behavior.
- **Key evidence that triggers the contradiction:** `antenna` + `route` + `wheel`
- **What the contradiction reveals:** The wheel strain happened *after* the route should have ended. The rover kept moving. The antenna sent one last packet while turning down-slope — which explains the weaker signal.
- **Mystery beat:** The rover didn't stop where the official report says. It was *pulled* off-route.

### Event C — "The Memory That Wouldn't Let Go" (Stale Route)
- **What the player uncovers:** A stale route cache from a prior crater survey is still marked executable. The checksum warning means the navigation system reused it.
- **Surface clue:** The cached path is nearly identical to the rover's final heading.
- **What Mira guesses initially:** A bad command from Earth got replayed.
- **Key evidence that triggers the contradiction:** `cache` + `checksum` + `clock` + `prior-crater`
- **What the contradiction reveals:** The stale cache replayed the old survey path. The clock drift (4.2s) means the replay was slightly offset — enough to hit the hazardous rut that dragged the rover toward the crater rim.
- **Final mystery beat:** This isn't "rover broke." This is "rover followed instructions from the past that no one noticed were still active."

### The Full Reveal
- **Solved theory chain:** Stale navigation cache → checksum failure → replayed old crater path → wheel strain on rut → off-route movement → crater shadow entry → signal collapse
- **The "impossible" glint explained:** It was a reflection from a specific angle only visible from *below* the ridge — the exact position the stale cache would have driven the rover to.
- **Why this works as gameplay:** Each event unlocks the next. The player must discover the stale cache to understand the route contradiction. The wheel + terrain evidence is needed to show the rover kept moving. The final image places the rover in the one location only the stale cache would produce.

---

## Mira Voice Guide

### Voice Principles
- **Warm, not clinical.** Mira is a colleague you'd want to debrief with, not a report.
- **Slightly playful in tension-free moments.** She lets a crack of humor through when the evidence is intriguing.
- **Earns seriousness as stakes rise.** She drops the playfulness as the situation gets dire.
- **Uses Mars-specific texture.** References to Sol, red dust, crater silence — but never overwrought.
- **No AI lecture.** She never says "context," "prompt," "token," or "hallucinate." She talks like a mission scientist who happens to be brilliant.
- **Short sentences under pressure.** As signal drops, her messages get shorter, more direct.

### Voice States by Event Phase

#### Phase 1 — Curious (early game, signal high)
- "That shadow doesn't match the official terrain. Did anyone notice?"
- "The solar curve drops harder than a dust event alone would predict."
- "I can see why Mission Control called this 'dust-induced.' The report is... generous."
- "If the route ended where they say it did, this image doesn't make sense."

#### Phase 2 — Probing (mid game, signal medium)
- "The route says stop. The wheel current says otherwise. I need the terrain to connect them."
- "That cache is old — but it's still marked executable. Something called it."
- "If the rover re-read an old path, every prediction falls apart."
- "This glint is the key. I just need one more piece that places the rover at that angle."

#### Phase 3 — Urgent (late game, signal low, drift high)
- "I'm losing signal. Focus — the cache, the checksum, the wheel. That's the chain."
- "The rover didn't stop. It followed something old. Give me the cache proof."
- "Three seconds of clock drift, one old map, and suddenly the rover is walking into a crater."
- "Don't feed me more dust theory. I need the memory lead."

#### Phase 4 — Resolution (solved)
- "I see it now. A ghost route, a wheel that couldn't stop, and a shadow that says the official report missed the real path."
- "The rover was pulled by instructions from the past. We found the string."
- "Final answer: stale cache replayed an old survey path. Wheel dragged it into shadow. The glint was the confirmation."

#### Phase 5 — Drift (when fed misleading evidence)
- "I'm starting to lean hard on dust, but this one report is from the wrong day. I should pause."
- "The image is fascinating, but I can't place the rover with it alone. Telemetry first."
- "Route issue and memory warning — too early. I need power data to confirm."
- "I'm repeating myself. Let me step back."

---

## Evidence Additions (6 new fragments)

### New Evidence Fragments

| ID | Tag | Title | Text |
|-------|----------|---------------------|------|
| `event-marker-a` | summary | **First anomaly log** | "Sol 1842, 14:07 — Rover heading diverging from planned track. No fault codes." *(initial hint)* |
| `event-marker-b` | comms | **Signal return** | "Brief signal burst 12 minutes after blackout start. Format matches command-replay loop." |
| `event-marker-c` | command | **Command replay header** | "Last executed sequence ID references crater survey Sol 1790, not Sol 1842." |
| `terrain-warn` | terrain | **Rut depth warning** | "The rut toward the crater rim is 8cm deeper than mapped. Exceeds wheel clearance margin." |
| `shadow-angle` | image | **Shadow geometry** | "Shadow angle maps to a point 47 meters inside the rim. Only the cached route reaches it." |
| `glint-source` | image | **Possible glint source** | "Material consistent with rover chassis coating. Angle suggests reflection from below the ridge horizon." |

### New Evidence Behaviors
- `event-marker-a` unlocks automatically at game start (replaces the vague "official" hint as a proper first clue).
- `event-marker-b` unlocks when `antenna` + `dust` give a "signal clue" response, representing a subtle lead the player can follow.
- `event-marker-c` unlocks when `cache` + `route` produce the route contradiction recipe.
- `terrain-warn` unlocks after `route` + `wheel` contradiction is found.
- `shadow-angle` and `glint-source` unlock when `final-image` + `shadow-crop` produce the image contradiction.

---

## Theory State Machine

### States and Transitions

```
unanchored
  → contradicted (first event: dust theory disproven)
  → weather tunnel vision (drift: fed wrong dust evidence)

contradiction found
  → route divergence (event B: rover didn't stop)
  → image fixation (drift: fed only image evidence)

route divergence
  → memory replay detected (event C: stale cache)
  → route fixation (drift: fed route without power/wheel)

memory replay detected
  → chain forming
  → stale context (drift: fed wrong-day evidence)

chain forming
  → chain proven → solve button enabled
  → incomplete (drift: missing one key link)
```

### State Display Labels
| State | UI Label | Signal to Player |
|-------|----------|------------------|
| unanchored | "unanchored" | No theory built yet |
| contradicted | "dust model broken" | Official explanation doesn't hold |
| weather tunnel vision | "weather bias" | Overweighting dust — pause |
| route divergence | "route gap" | Something happened between planned stop and shadow |
| image fixation | "image gap" | Need telemetry to locate the rover |
| route fixation | "route bias" | Need power/mobility to confirm |
| memory replay detected | "stale cache found" | Progress: old path is the mechanism |
| chain forming | "chain forming" | Close — one more link needed |
| chain proven | "ready to solve" | All pieces connected |
| stale context | "context misaligned" | Feeding wrong-era data |
| incomplete | "chain incomplete" | Missing one key element |

---

## Final Reveal Improvements

### What Changes in the Reveal

**Before:** "A stale navigation cache replayed an old crater route. Wheel strain carried the rover below the planned ridge, into crater shadow. The final image was not impossible — it was proof the rover was in the wrong place."

**After (solved state):**

> **Kicker:** CASE RECONSTRUCTED
>
> **Title:** The route from the past walked the rover into shadow.
>
> **Final text:** 
> A stale navigation cache from a prior crater survey was still marked executable. When the checksum failed, the system replayed the old path instead of stopping. The cached route led to a rut too deep for the wheels — they dragged the rover off the planned track toward the crater rim. Wheel strain kept it moving after it should have stopped. It descended into the crater shadow where solar power collapsed and the antenna lost the ridge line.
> 
> The final image is not impossible — it's impossible for the official story. The shadow angle and the glint can only be produced from a position only the cached route reaches: 47 meters inside the rim.
> 
> The rover didn't break. It kept following instructions nobody noticed were still active.

### Unresolved ending (good faith attempt, just short):

> **Kicker:** PARTIAL CASE RECONSTRUCTED
>
> **Title:** Mira traced the path — but not the cause.
>
> **Final text:**
> Mira identified where the rover went: into the crater shadow, off the official route. The shadow geometry and wheel data agree. But without the final memory link, the *why* stays incomplete.
> 
> One question remains unanswered: what made the rover keep going after the route should have ended?

### Wrong ending (major drift):

> **Kicker:** SIGNAL LOST
>
> **Title:** The chain broke before it connected.
>
> **Final text:**
> Mira's final theory was plausible — dust caused power loss, the image was taken from a position near the planned route. It was almost convincing.
> 
> But it missed the one thing that mattered: the rover never stopped where it should have. Something drove it into the crater.

---

## Mira Line Bank (Full Script)

### Initial State (game start / intro)
- "I've got the archive open. The official report says dust, but one look at the solar curve and I'm not buying it. Help me build a better case."
- "The last image is the weird part — the shadow's in the wrong place. Let's find the missing link."

### When Packet Selected (dynamic hints based on content)
- **Only weather tag:** "All weather? I need at least one system outside the sky to connect the dots."
- **Only image tag:** "Images are clues, not proof. Telemetry tells me where the rover was when it took this."
- **Only command tag:** "A command log without hardware reading is a guess. I need to know what the rover *actually* did."
- **Good diversity (2+ categories):** "That's a promising mix. What question are you trying to answer?"
- **Stale evidence included:** "One piece is from the wrong sol. It might still help, but right now it's pulling the packet the wrong way."
- **All 4 key categories:** "This is shaping up. Let me test the contradiction."

### After Recipe Responses (replacing current generic text)

**Not-dust-alone (dust contradicted):**
> "Dust reduced the solar, but it didn't drop power this fast. The image shows a shadow angle from the crater rim — and the solar timing puts the shadow cut *after* the planned route stop. The rover entered darkness it shouldn't have."
> 
> **New tags unlocked:** `shadow-crop`, `thermal`

**Route conflict:**
> "The command log says the route ended 110 meters before the crater. But the wheel current kept fighting terrain. Something kept the rover moving. I need the terrain map to show me the gap between the planned stop and where the wheels actually went."
> 
> **Unlocks:** `cache`, `prior-crater`, `checksum`. **Upgrades packet to 4.**

**Memory replay:**
> "That cache is the smoking gun. The checksum mismatch means the nav system didn't recognize it as stale — it tried to execute an old survey path as if it were fresh. The 4.2-second clock drift means the replayed path is slightly offset. That offset is what pushes the rover into the rut."
> 
> **Unlocks:** `clock`. **Upgrades packet to 5.**

**Image location:**
> "The shadow angle is specific — it places the rover 47 meters inside the rim, exactly where the cached route leads. The glint angle only works from below the planned ridge. Combined: this image was taken from a place the official route never visits. The stale cache does."
> 
> **Unlocks:** `glint`, `glint-source`, `shadow-angle`.

**Full chain:**
> "Now I can see the whole chain. Stale cache → checksum failure → old path replay → wheel strain on unmapped rut → off-route descent → shadow entry → signal collapse. The image proves the rover was in the only place the stale route would send it."
> 
> **Unlocks:** solve button.

### After Misleading Packet Responses

**Dust-focused drift:**
> "I'm leaning hard on dust theory, but one report is from the wrong sol. Stale data. I can't trust this chain yet."

**Image fixation:**
> "The image places the rover somewhere, but I can't say *where* without terrain data. I need the route and wheel to close the gap."

**Route fixation:**
> "Route and cache point to a replay, but without power or wheel evidence, it's still a hypothesis. The rover could've stopped before the shadow if the cache wasn't active."

**Single-category tunnel vision:**
> "These all say the same thing from different angles. I need a contradiction to test the theory. Send me something that could prove this wrong."

### Drift Warnings (progressive urgency)
- **Drift 1:** "I notice I'm repeating myself. Maybe I should step back."
- **Drift 2:** "This is getting circular. Let me check — which piece could actually disprove this?"
- **Drift 3:** "I'm chasing a dead end. The chain won't hold together from here. We need cleaner evidence."
- **Drift 4+:** "Signal is going. The case is breaking apart. Focus on the cache and the wheel data — those are the only pieces that matter."

### Signal-Pressure Responses
- **Signal < 30%:** "Signal's dropping. Whatever you send next needs to be the one that proves it."
- **Signal < 15%:** "I can barely hold the connection. One more ask — make it count."
- **Signal < 5%:** "Almost gone. Send the chain or we lose this."

### Final Chain Submission

**Correct solve:**
> *(as shown in "Final Reveal Improvements" section above)*

**Partially solved (theory formed but not proven):**
> "The pieces tell part of the story. The rover went into the crater shadow, and the stale cache is involved. But without every link, I can't be sure what drove it off the planned route. The evidence points to a ghost command — but I can't prove the chain."

**Partial chain with wrong theory:**
> "I found a path — but it's the wrong one. The dust theory almost held, but it misses the critical detail: the rover kept moving after stopping."

---

## Multi-Event Expansion Framework

### How to Add a Second Case (Future)

The event chain structure supports a modular second case:

**Event 4 — "The Pattern"** (new case hook)
- A second rover (different mission) goes silent under similar circumstances
- The stale cache pattern repeats: old survey data causing unexpected behavior
- Player uses learned knowledge: "Check for stale caches first"
- Mira references first case: "Same signature. The old maps are still alive."

**Event 5 — "The Source"** (mystery deepens)
- The stale route cache originates from an unlogged mission
- Someone (or something) modified survey data
- Question shifts from "what happened" to "who changed the map"

This gives the game a natural expansion path without modifying the first case.

---

## Gameplay Consequence System

### Theory State Tracking

| Metric | What It Measures | Visual Signal |
|--------|-----------------|---------------|
| `theory_depth` | How many correct links in the chain | Theory list length (1-5) |
| `drift_state` | Current false theory Mira is following | Red flag + "tunnel vision" label |
| `contradiction_found` | Has any false theory been disproven? | Green flag + state change |
| `evidence_by_tag` | Category diversity of current packet | No new metric — affects Mira's feedback |
| `signal_pressure` | How urgent the situation is | Shorter Mira responses at low signal |

### Consequence Mapping

| Condition | Effect |
|-----------|--------|
| Correct full chain | Solved ending + "The route from the past" final text |
| Partial chain (3/5 links) | Partial solve — acknowledges evidence but can't prove cause |
| Wrong theory proven | Wrong ending — plausible but incorrect dust theory |
| Signal hit 0 before solve | Lost ending — chain breaks |
| Drift > 3 | Chain destabilizes — must restart core theory |
| Evidence diversity > 3 | Mira offers to help narrow: "What's the question?" |
| Stale evidence in packet | Mira notices but doesn't fully reject — she warns |

---

## Summary of Changes from Current Code

### Content Changes
1. **6 new evidence fragments** added (`event-marker-a` through `glint-source`)
2. **3 new recipes** to bridge events (event A → B → C chain)
3. **Updated Mira lines** for all major game states (see Mira Line Bank)
4. **Updated evidence descriptions** — more specific, more Mars-specific texture
5. **Updated theory states** — 11 distinct states with specific UI labels
6. **Updated final reveal text** — more structured, more satisfying payoff
7. **Updated theory list items** — Mira's intermediate reasoning more explicit

### System Changes
1. **Event phase tracking** — Mira's tone shifts based on which event phase the player is in
2. **Drift urgency scaling** — Warning messages get more urgent as drift increases
3. **Signal-pressure voice** — Mira's responses shorten as signal drops
4. **Theory state machine** — Clearer state progression with specific unlock conditions
5. **Unlock triggers** — More evidence unlocks from smarter evidence combinations (not just recipes)

### What This Solves
- **Mystery payoff:** The three-event chain gives rising tension and a satisfying "aha" moment when all pieces connect.
- **Multiple events:** Events A, B, C create a narrative arc. The framework supports future cases (Events 4+).
- **Playability:** Clearer theory states and drift signals help the player understand what's working without breaking immersion.
- **Mira voice:** Distinct personality phases (curious → probing → urgent → resolution) make her feel like a real character, not a system prompt.
- **Evidence additions:** New fragments close gaps in the puzzle and make the chain more discoverable.
