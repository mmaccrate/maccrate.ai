# What Happened to the Rover? — Agent Synthesis for a Better Loop

Date: 2026-07-03
Scope: `maccrate-4096` only. Do not touch `maccrate-main`.

## Inputs used

- User feedback: overlaps make interactions impossible; questions feel generic; no real intro; adding more UI will not fix the loop.
- Browser visual QA of current initial state.
- Playwright overlap probes at desktop and mobile sizes.
- Agency Agents role discovery: Game Designer, Narrative Designer, UX Architect, UI Designer, Level Designer, Reality Checker, Product Manager.
- Prior constraints: no dashboard/productivity UI, no Promptcraft, no 2048/jazz assumption, keep Mira + Mars mystery + stale route/cache truth.

Note: delegated subagents were attempted for game, narrative, and UX review, but all three timed out. I am not treating that as success. This synthesis uses the discovered agent roles as explicit review lenses plus direct browser/tool evidence.

## Reality Checker verdict

NEEDS WORK. The current direction is still trying to rescue the loop by arranging panels around a weak interaction model.

The problem is not just CSS overlap. The deeper issue is:

> The player is being asked to satisfy hidden clue recipes before they understand the incident.

The UI says "Question 1" and "pin evidence," but the player has not lived the moment of the rover going missing. That makes even correct clues feel like arbitrary UI tokens.

## Current blockers from QA

1. **No playable cold open**
   The player starts at an abstract question: "Did dust really kill it?" There is no emotional/mission setup.

2. **Panels compete with the scene**
   Mira bubble, question card, clue card, bottom tray, signal meter, and hotspots all fight for the same space.

3. **Interaction contract is unclear**
   Sometimes the player can inspect, sometimes pin, sometimes transmit, sometimes not. It feels like a form hidden inside a scene.

4. **Hidden recipe logic feels random**
   The player does not know why a packet is good except after being corrected.

5. **Overlap bugs are a symptom of wrong layout architecture**
   Absolute-positioned HUDs over a hotspot map will keep creating blocked interactions unless the layout is rebuilt around safe zones.

## Replacement concept: "Find the contradiction"

### One-sentence pitch

Mira replays the rover's last minute. The player tests each official claim by tapping scene evidence that proves the claim cannot be true.

### Why this is better

This changes the player goal from:

> "Guess which three clues satisfy Mira."

into:

> "This claim says X. Find the thing in the scene that makes X impossible."

That is more understandable, more mystery-like, and closer to the AI-context metaphor without saying so. The player is selecting contradiction checks, not collecting arbitrary cards.

## New core loop

Each beat uses the same clear rhythm:

1. **Mira states a concrete official claim.**
   Example: "Official report: dust knocked the rover out on the ridge."

2. **The player taps the claim source.**
   This anchors the question in-world: report, route line, command cache.

3. **Mira asks for one contradiction.**
   Example: "Find the thing that makes this report impossible."

4. **The player taps evidence in the scene.**
   Not three slots. Not a generic packet. Just the evidence that challenges the claim.

5. **The scene changes immediately.**
   Dust claim cracks -> shadow appears. Route claim cracks -> ghost trail appears. Cache claim cracks -> replay animates into the rut.

6. **Mira summarizes the new fact in one line.**
   Example: "Dust was real. It just was not the killer. The rover was already below the ridge."

7. **Next claim appears.**
   The player always understands why the next stage exists.

## Three authored beats

### Beat 0 — Cold open: Last packet

Purpose: replace the generic intro.

Flow:
- Black/rust title screen.
- A short radio burst animates in, not a paragraph.
- Mira appears: "Control? I found the rover's last packet. The report says dust. The image says... no."
- Scene fades in with one glowing item: **Final Image**.
- Player taps it.
- Mira: "That's crater shadow. The rover was not supposed to be anywhere near it. Let's test the report."

This teaches: tap glowing scene evidence; Mira reacts; mystery begins.

### Beat 1 — Official claim: Dust killed it

Claim source: **Dust Report**

Mira line:
> "Official report: dust event, power loss, rover silent on the ridge. Neat. Too neat. Find what breaks it."

Contradictions:
- **Solar Drop**: power falls too sharply for moderate dust.
- **Final Image**: shadow angle implies below-ridge position.

Success:
- Shadow band appears on the crater.
- Mira: "Dust reduced power, but shadow killed it. The rover was already lower than the report admits."

### Beat 2 — Official claim: Route ended safely

Claim source: **Planned Stop**

Mira line:
> "The route says it stopped here. The picture says it didn't. Find the track that keeps going."

Contradictions:
- **Wheel Marks**: tracks continue beyond the planned stop.
- **Rim Rut**: rut bends the path toward the crater.

Success:
- Ghost route draws past the stop.
- Mira: "The rover did not stop. The ground pulled the wheels downslope. Now we need what told it to keep driving."

### Beat 3 — Official claim: No command after stop

Claim source: **Old Cache**

Mira line:
> "No new command was sent. So why did it drive? Check the old memory."

Contradictions:
- **Memory Scar**: checksum failed before final drive.
- **Clock Drift**: old route replay started offset enough to hit the rut.

Success:
- Ghost route animates into crater shadow.
- Final **Glint** appears.
- Mira: "There. It followed an old route with a tiny timing drift. The final glint is where the official route can never be."

### Final call

The final action is not another packet. It is a confident reconstruction:

> Stale cache -> checksum failure -> old route replay -> clock drift -> rut -> shadow -> signal loss.

## Layout architecture: no more overlap-prone HUD stack

### Rule 1 — One interactive scene layer

The scene contains only:
- terrain art
- route/replay art
- hotspot buttons
- anchored hotspot labels

No objective cards, Mira cards, clue cards, or bottom tray may sit on top of clickable scene space in the resting state.

### Rule 2 — Use explicit CSS grid lanes

Viewport structure:

```
.app
  .top-strip        // title + signal only, not over scene
  .scene-stage      // only clickable scene/hotspots
  .radio-strip      // Mira line + current claim + one action
```

The radio strip is outside the scene, not absolute over it. The scene height is calculated after reserving the strip.

### Rule 3 — Inspection is a bottom sheet with a clear mode

When a clue is inspected:
- A small bottom sheet replaces the radio strip.
- The scene remains visible above it.
- Other hotspots are intentionally inactive until the sheet closes.
- This is not a hidden obstruction; it is a clear "inspecting clue" mode.

### Rule 4 — Remove persistent tray/slot UI

No 0/3 slots. No clear button. No permanent radio tray. These read as a form and invite random clicking.

Instead:
- Player taps a claim/evidence.
- Mira says whether it anchors, contradicts, or is for later.
- The current beat stores progress silently and visually changes the scene.

### Rule 5 — Hotspots are never placed in reserved UI zones

Do not position hotspots in the top strip or bottom strip. Use scene-local coordinates only inside the safe scene area.

Verification requirement:
- For every hotspot, `document.elementFromPoint(center)` must return that hotspot in resting scene mode.
- In inspect mode, only the bottom-sheet controls need to be clickable; scene clicks are intentionally paused.

## UI copy direction

Avoid:
- "Question 1"
- "radio tray"
- "pin what helps"
- "packet too thin"
- generic "Find X, Y, Z"

Use:
- "Official claim"
- "Find what breaks it"
- "Test this"
- "This contradicts the report"
- "Mira found a new path"

## Mira voice samples

Cold open:
> "Control? I found the rover's last packet. The report says dust. The image says... no."

After final image:
> "That is crater shadow. The rover was not supposed to reach shadow. Let's test the report."

After wrong evidence:
> "Useful later, not for this claim. I need the thing that makes the report impossible."

After dust contradiction:
> "Dust is real. It just is not the killer. The rover was already below the ridge."

After route contradiction:
> "The map says stop. The dirt says keep going. Trust the dirt."

After memory contradiction:
> "Old route. Fresh failure. Tiny clock drift. Big crater."

Final:
> "The rover did not break. It kept following instructions nobody noticed were still alive."

## Acceptance criteria for implementation

1. The first 10 seconds explain:
   - player = mission control / investigator
   - Mira = companion with last packet
   - official story = dust
   - contradiction = final image in impossible shadow

2. Resting scene has zero UI overlays on clickable hotspots.

3. There is no slot/tray form in the primary loop.

4. Player's repeated verb is clear: tap a claim, then tap what contradicts it.

5. Every correct action changes the scene visibly.

6. Wrong clicks do not punish; they redirect.

7. Mobile layout has no absolute overlays over the scene except intentional inspect bottom sheet.

8. No dashboard/productivity visual language.

## Implementation recommendation

Do not patch the current panel stack. Replace the interaction screen architecture with the grid-lane model and the contradiction loop. Reuse the existing Mars scene art and hotspots where useful, but rewrite the state machine from `selected[] / SLOT_MAX / recipes` to:

```
beat = intro | dustClaim | routeClaim | memoryClaim | solve
claimTapped = false
requiredContradictions = [...]
foundContradictions = {...}
```

This is a product-level correction, not a copy polish pass.
