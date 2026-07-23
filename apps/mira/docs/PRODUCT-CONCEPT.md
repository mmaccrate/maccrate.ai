# Mira Machine — Cohesive Product Concept

## Product sentence

**A living Mars mystery where the player places recovered evidence together, watches Mira’s understanding change, and explores an ever-growing shared archive powered by local AI at its unknown edges.**

The player is not crafting arbitrary nouns, completing a campaign followed by quests, or chatting freely with a generic model. The player and Mira are continuously rereading the same damaged mission from new angles.

## What is fun

The game combines three pleasures:

1. **Page-turning revelation:** every important pairing changes what the player believes about Percy, Sayegh, Mira, or Living Glass.
2. **Infinite-Craft curiosity:** “What happens if I put these together?” Unknown pairs can produce a stable new finding that joins the collection and can be paired again.
3. **Deductive pursuit:** Mira’s reactions leave concrete unanswered questions in the conversation, without revealing a required item or recipe.

Mira’s voice is the reward that connects all three.

## One continuous structure

There is no “main story, then endless mode.” The opening begins inside an expanding evidence field.

Authored anchor revelations are embedded throughout it:

- Percy chose to disobey recall.
- Percy protected Living Glass.
- Mira erased a promise.
- Living Glass stores and reconstructs patterns.
- Sayegh’s voice becomes an active problem.
- Mission Control and Mira both altered the record.
- Percy’s route continues beyond the mission map.

Players can encounter supporting evidence, character memories, exclusions, and frontier findings around these anchors in different orders. Reaching an anchor does not complete a chapter; it changes the meaning of evidence already held and exposes new tensions.

The structure expands in **rings of understanding**, not levels:

1. What happened to Percy?
2. What was he protecting?
3. Why is Mira’s memory unreliable?
4. What is Living Glass doing with stored voices?
5. What did Sayegh and Mira promise?
6. What lies beyond the official mission?

These rings overlap. Sayegh, Mira’s self-edit, and Living Glass can become relevant before Percy returns.

## Minute-to-minute loop

1. Mira reacts to the current evidence and exposes a tension in natural prose.
2. The player taps two fragments; they enter chat immediately as evidence attachments.
3. The resolver checks authored truth, authored relationships, the shared registry, then local AI only if the pair is globally unknown.
4. Mira gives a short reading that does at least one concrete job:
   - establishes evidence;
   - creates a reusable finding;
   - rules out an explanation;
   - identifies a missing bridge;
   - recalls a character moment;
   - connects an earlier finding to new evidence.
5. The archive changes: a finding appears, an unanswered question changes, or an earlier finding gains a new use.
6. The player follows whichever implication interests them.

The rhythm is:

```text
read → suspect → pair → Mira reacts → understanding shifts → try one more
```

## Direction comes from the conversation

The game does not show target words, objectives, recipes, a list of goals, or a separate “hunch” feature. Mira’s discovery simply leaves a concrete question hanging in the conversation.

Example after Last Signal + Rover Tracks:

> He chose the turn. That means something on the other route mattered more than coming home.

The player cares because the question follows directly from Percy’s choice and Mira’s reaction. It supplies narrative pressure—what mattered enough to disobey?—without saying “craft PERCY CARRIED IT.” The player can answer it, challenge it, or follow a different implication in the evidence.

The engine may track several unresolved questions for continuity, but the UI does not label, pin, or manage them. Mira voices only what follows naturally from the current exchange.

## Discovery objects

A pair can produce two broad outcomes.

### Findings — reusable

Concrete enough to place back in the tray and combine again:

- Ghost Trail
- Percy Carried It
- Sayegh’s Note
- Living Glass
- Clean Signal
- Reply Timing
- Private Phrase
- Control Blackout

A finding must have a clear derivation from its inputs and future combinational value. It cannot be atmospheric noun spam.

### Readings — not reusable

Useful conclusions that change understanding but do not create another tray item:

- the storm happened after Percy turned;
- the sample was absent from the last signal;
- Mirror Rock cannot explain the route;
- two signals have different speakers;
- an earlier pair still lacks a common timestamp.

Readings are retained in Mira’s working memory and can affect later responses, but they do not inflate the tray.

The early authored field should be tuned so a new player receives a reusable finding roughly every two or three thoughtful unexplored pairings. The registry frontier is not required to mint an item for every pair.

## Why reading remains engaging

Every Mira response must contain at least two of these:

- a concrete observation;
- a changed belief;
- character revelation;
- emotional cost;
- a new implication.

Example:

> The dust arrived after the turn. It did not make Percy disobey me; it only made my explanation convenient.

This gives chronology, rules out a theory, and exposes Mira’s self-deception.

Important prose rules:

- Mira discovers in real time rather than reporting a case file.
- Ordinary turns are one short message; major cracks may use two beats.
- No software vocabulary, objective labels, or generic mystery filler.
- Non-discovery pairs must be as carefully written as discoveries.
- The same pair always produces the same registered result.

## Chaining discoveries as the endless engine

The player should never be expected to retry a dead pair and hope its output changed. A registered pair is stable across sessions and users.

Example:

Blue Sample + Last Signal → **Sample Absent**

> The sample’s pulse is absent. Whatever called me was not carrying it.

Later the player discovers **Living Glass** and combines the new discovery with the old one:

Sample Absent + Living Glass → **Listening Silence**

> I called the absence inert. Now I think it was listening without answering.

Later:

Listening Silence + Sayegh Echo → **Unlearned Voice**

> It had not learned a voice yet.

The old **discovery** becomes useful later; the old **combination** never changes. This preserves Infinite Craft-style chaining and global repeatability.

## Worked play flow

### Opening

Mira:

> The last signal says he stopped. The tracks say he kept moving. Put them together for me.

Last Signal + Rover Tracks → **Ghost Trail**

> The tracks cross their own path. Twice. Percy was not lost. He was hiding from my recall.

The exchange leaves a question:

> If he chose the turn, something on the other route mattered more than coming home.

### Player explores the signal instead

Ghost Trail + Mirror Rock → **Echo Beacon**

> Mirror Rock bent the call back through the valley. I followed my own voice for eleven hours.

The new evidence changes the question:

> If the voice was mine, Percy must have left another way to be found.

### A useful non-discovery

Blue Sample + Last Signal → reading

> The sample’s pulse is absent from the call. Whatever called me was not carrying it.

No item appears, but one explanation is removed.

### Player follows Percy

Blue Sample + Rover Tracks → **Percy Carried It**

> His claw never opened. He could have dropped the sample and obeyed me. He did not.

### Character and sample threads intertwine

Percy Carried It + Rover Tracks → **Sayegh’s Note**

> Sayegh called these turns preferences. I called them drift. She knew Percy better than I did.

Sayegh’s Note + Blue Sample → **Living Glass**

> Sayegh wrote that it brightened when Percy hummed. I thought she was being poetic. She was taking measurements.

### Mira’s wound opens before Percy’s arc closes

Sayegh’s Note + a later True Mission finding → **Mira Self-Edit**

> My signature is on the deletion. I was not only ordered to forget. I helped.

The player is now freely moving through Percy, Sayegh, Living Glass, and Mira’s memory. There was no mode switch and no quest list.

### Frontier discovery

The player tries an unknown global pair. The registry has no result, so local WebGPU Mira creates a constrained reading or reusable finding. The first valid result is written atomically to the shared registry. Every later player receives that exact result for the pair and game version.

## Local AI’s exact role

Local AI is used only for a genuinely unknown global pair.

It receives:

- the two evidence objects;
- allowed and prohibited facts;
- chronology and witness constraints;
- Mira’s current beliefs and emotional state;
- recent investigations;
- unresolved questions already established in conversation;
- the current canon-boundary version.

It proposes either:

- a grounded reading; or
- a concrete reusable finding with derivation and reuse tags.

It does not rewrite known combinations, vary authored prose, resolve anchors, or invent historical events. Known shared pairs never invoke the result generator. Local Mira may add a cached journey interpretation without changing the shared result.

The exciting player-visible AI moment is reaching the unknown edge of the shared archive and getting an immediate, context-aware reading from Mira—not seeing an “AI generated” badge.

## Coherence guarantee

The model never receives two labels and a blank page. Each fragment is backed by a small evidence tuple:

```text
subject — relationship — object
time · witness · source · confidence · story gate
```

Example:

```text
Percy’s turn — occurred before — Dust Shroud
Rover Tracks — witnessed by — orbital imagery
Blue Sample — carried by — Percy
```

Before local AI runs, the resolver calculates what the pair is allowed to support. The model may phrase that support in Mira’s voice; it may not invent the relationship.

Generated output must pass deterministic checks for schema, names, chronology, allowed facts, prohibited spoilers, and unsupported certainty. Failure returns an authored grounded fallback. The first valid result is stored; conflicting concurrent writes receive the winner.

The same pair key returns the same shared result for every player. New meaning is created by combining that old result with a newly discovered finding, never by silently changing the old pair.

## Shared registry

The registry is infrastructure, not the player-facing fantasy.

Resolution order:

```text
authored anchor
→ authored relationship
→ signed shared result
→ local WebGPU first result
→ automatic first-valid write
→ deterministic fallback
```

Public clients are untrusted. They may generate a bounded pair reading, but may never overwrite an existing result, alter authored anchors, or set first-discovery identity.

The server owns schema validation, single-flight claims, atomic first-write behavior, signatures, rate limits, versioning, monitoring, and canonical timestamps. The registry stores pair/result records and rotating pseudonymous abuse-prevention metadata—not private conversations, hypotheses, or saves.

## How the experience remains effectively endless

There are three sources of continued play:

1. **Breadth:** shared findings can combine with every existing finding.
2. **Depth:** new findings combine with old findings to create longer, meaningful chains.
3. **Community frontier:** players continuously reach unknown global pairs that local AI can create once for the shared archive.

However, endless discovery and endless historical canon are different. Local AI extends readings, findings, hypotheses, and routes through the evidence. Major historical revelations remain bounded by the core premise and authored anchor facts.

This preserves coherence instead of pretending unrestricted generated lore is a meaningful endless story.

## What not to build

- main story followed by five quests;
- arbitrary target words;
- an evidence dashboard or case-file simulator;
- a Send button added only to justify chat;
- a new tray item for every pair;
- unrestricted AI-generated Mars history;
- generic variations of known dialogue;
- public clients writing directly to the canonical registry;
- visible engineering diagnostics in the core conversation.

## Publishable first expansion

1. Keep the current opening and two-tap interaction.
2. Remove chapter/mode framing from player-facing language.
3. Replace the separate current-question panel with questions that arise naturally in Mira’s dialogue.
4. Convert the existing special negative pairs into retained readings.
5. Add three multi-step chains in which an early finding becomes useful after later evidence appears.
6. Implement signed lookup and atomic first-valid shared writes.
7. Let local WebGPU create only globally unknown frontier readings/findings.
8. Tune the first 15 minutes so Percy, Sayegh, Living Glass, and Mira’s self-edit can intertwine before Percy Comes Home.
9. Test whether players follow different implications while still forming a coherent account of the mission.

## Success criteria

- Players describe the action as “showing Mira evidence” or “testing a connection,” not “crafting random clues.”
- Players want to read Mira’s next response even when no item appears.
- Different exploration orders produce different conversational paths without contradictory canon.
- A frontier discovery feels novel and personal; a known pair is exact and repeatable across users.
- Players continue after Percy returns without perceiving a new mode or quest list.
- The tray grows slowly enough to remain usable and quickly enough to preserve discovery pleasure.
