# Final release audit — 2026-07-18

## Scope

End-to-end review of `maccrate.ai` → Mira case study → Mira game, including desktop/mobile presentation, onboarding, authored and unknown pair behavior, returning-player recovery, shared-registry trust, accessibility, repository organization, and private deployment handoff.

Review perspectives: recruiter, creative director, nontechnical visitor, casual mobile player, interactive-fiction player, deduction player, returning player, AI/privacy skeptic, accessibility reviewer, maintainer, security reviewer, and deployment operator.

## Release verdict

**Code-freeze candidate after the fixes below.** The production-built portfolio is memorable and coherent; the case study establishes ownership and architecture; Mira has a strong opening and stable two-tap interaction. The full deterministic test suite passes.

Remaining operator gates are Docker/nginx execution on Bebop and physical-GPU WebGPU validation. Story mode remains fully playable if local WebGPU initialization is unavailable.

## High-value findings fixed

1. **Valid saved progress was overwritten on load.** Startup now distinguishes a new investigation from a meaningful saved investigation and presents an accurate restored-state prompt.
2. **A single selected fragment was not saved.** Selecting or deselecting the first fragment now persists immediately.
3. **Generated frontier findings could disappear on reload.** Bounded, sanitized frontier definitions are now stored and reconstructed before discovered IDs are validated.
4. **Restart could erase progress accidentally.** Restart now requires explicit confirmation; dismissal preserves the run.
5. **Reversed/repeated pairs duplicated investigation history.** Stable repeats replay their result without adding another history/attention record.
6. **Opening fragments looked tappable while Mira was still speaking.** The tray now says `Mira is checking the records…`, and disabled evidence has an intentional waiting treatment.
7. **Header/filter controls were below mobile accessibility guidance.** Local-AI, restart, and filter controls now have a 44px minimum target at 320px and above.
8. **Local-AI trust copy was too implicit.** The control is `Wake local Mira`; activation explains that Gemma runs in-browser and only new discovery proposals may go to the shared registry for review. Story-mode fallback is explicit.
9. **A resume prompt personified a record as lying.** It now asks which record was altered.
10. **Debug state could become stale after reset.** The debug state property is now a live getter.

## Verified behavior

- Homepage production build contains `https://mira.maccrate.ai/`, never localhost/Tailscale/Hermes URLs.
- Production build has no Astro development toolbar.
- Homepage and case study have canonical, Open Graph, viewport, sitemap, privacy, terms, accessibility, and skip-link coverage.
- Mobile has no horizontal overflow at 320px or 390px.
- All visible game controls are at least 44px high; evidence cards are 56px or taller.
- Partial discoveries, tried pairs, beliefs, branches, resolutions, generated findings, and one pending selection survive reload.
- Reload gives an investigation recap instead of replaying the first tutorial.
- `A + B` and `B + A` return the same result and do not duplicate discoveries/history.
- Unknown-pair local generation is cached; authored and grounded relationship pairs avoid unnecessary AI calls.
- Registry client rejects malformed/unsigned results and verifies canonical signatures.
- Live D1 → Worker → ECDSA signature → browser-client verification passed using a temporary record that was deleted afterward.
- Registry health and authorized CORS preflight pass.
- Full authored playthrough, alternate exploration orders, state sanitizer, mobile/desktop QA, registry security, release persistence, and production portfolio tests pass.

## Product strengths

- First five seconds are memorable: editorial cover, concise mystery hook, one primary action.
- Portfolio teaser, case-study explanation, and game opening tell the same story.
- Mira's voice is specific, wounded, and dry rather than generic assistant copy.
- The first successful pair teaches the product contract clearly.
- Authored truth, stable shared discoveries, and unknown local interpretation have clear technical authority boundaries.
- The two-tap loop remains free of fake player dialogue or additional send controls.

## Deferred opportunities—not freeze blockers

- Split the ~918-line `src/pages/index.astro` into story data, persistence, resolver/frontier, registry, and rendering modules after launch. Do not perform this risky refactor immediately before deployment.
- Add lightweight grouping or open-question navigation if the evidence inventory regularly exceeds ~15–20 items in public play.
- Remove confirmed-unused legacy components after launch.
- Fingerprint non-hashed public integration/runtime scripts or revisit their seven-day cache policy.
- Add public source/process links only if those materials are intentionally publishable.
- Consider making Max's product/design/engineering scope slightly more explicit on future multi-project homepage revisions.

## Known release gates

1. **Physical WebGPU:** Hermes' software adapter cannot load the current Gemma path because of its buffer/operation limits. Validate `Wake local Mira` on the target Chrome/GPU over HTTPS. Do not describe physical WebGPU as verified before that test.
2. **Docker:** Docker is unavailable in the Hermes environment. Build, Compose activation, nginx routing, container health, and rollback must be exercised on Bebop.
3. **TLS/DNS:** Confirm `mira.maccrate.ai` points to Bebop, remains correctly proxied, and is covered by the nginx certificate.
4. **Low development dependency advisories:** npm reports two low-severity esbuild development-server issues affecting Windows. Production is static nginx on Linux; avoid a breaking Astro 7 upgrade during freeze.

## Canonical QA commands

```bash
# Portfolio
npm run test:release
npm audit --omit=dev --audit-level=high
git diff --check

# Mira
npm run build
npm run test:registry
npm run test:exploration
npm run test:game
npm run test:release
npm audit --omit=dev --audit-level=high
git diff --check

# Deployment package
bash -n scripts/*.sh
git diff --check
```

All commands above passed on the release candidate, with only the documented low-severity development dependency advisories.
