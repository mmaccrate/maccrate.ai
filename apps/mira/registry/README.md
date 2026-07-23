# Mira Shared Pair Registry

The registry gives every evidence pair one permanent result for a game version.

```text
lookup sorted pair
→ existing result: return its signed entry
→ unseen pair: issue one short-lived generation claim
→ Local Mira generates and submits a constrained result
→ first valid write wins atomically
→ every later lookup returns that exact signed result
```

There is no player-facing provisional/approved state and no manual review queue in the active path.

## Responsibilities

- D1 enforces one row per `(pair_id, game_version)`.
- The Worker recomputes order-independent pair IDs.
- A ten-minute HMAC claim binds one generator to one pair, version, and rotating pseudonymous network hash.
- Submitted text passes strict schema, source, length, control-character, HTML/injection, and identifier checks.
- The first valid insert wins; concurrent losers receive the already-written result.
- Every stored response is signed with ECDSA P-256 and verified in the browser.
- The registry stores pair results and abuse-prevention metadata—not conversations, hypotheses, save files, or accounts.
- Authored recipes and relationships continue to outrank registry results.

## Security boundary

The browser and local model are untrusted. Current automatic validation is deliberately conservative but cannot prove the semantic truth of arbitrary prose. Generated pair results therefore remain bounded readings/findings derived from the client’s deterministic evidence kernel; they cannot establish authored anchor facts or rewrite mission history. Rate limiting, monitoring, retirement tooling, and game-version rotation remain necessary operational controls.

## Local development

```bash
npm run registry:migrate:local
npm run registry:dev
```

Local Wrangler requires non-production values for:

- `PROPOSAL_HMAC_SECRET`
- `IP_HASH_SECRET`
- `REGISTRY_SIGNING_PRIVATE_JWK`

Never commit those values or production credentials.

## Remote operations

No remote migration or deployment is automatic:

```bash
npm run registry:migrate:remote
npm run registry:deploy
```

Those commands require explicit operator authorization and real Cloudflare configuration. This repository does not invent or embed Cloudflare secrets.

## Tests

```bash
npm run test:registry
```

Coverage includes order-independent pair IDs, strict schemas, source restrictions, common injection rejection, signed browser lookup, automatic first-valid writes, duplicate handling, and stable repeat caching.
