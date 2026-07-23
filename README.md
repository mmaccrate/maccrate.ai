# maccrate.ai monorepo

Canonical source for the MacCrate portfolio and its independently deployed projects.

## Structure

```text
apps/
  web/   # portfolio → https://maccrate.ai
  mira/  # Mira game → https://mira.maccrate.ai
projects/
  hello-world-ai-fine-tuning/  # public notebook, datasets, and retained evidence
```

Deployable experiences belong under `apps/<project-name>/` and can have their own domain, build, tests, and runtime architecture. Research and article evidence that should be published with the portfolio belongs under `projects/<project-name>/`. Both share one Git history and deployment repository.

## Build contract

- Node.js 20
- Install everything: `npm ci`
- Build everything: `npm run build`
- Portfolio output: `apps/web/dist/`
- Mira output: `apps/mira/dist/`

Targeted builds:

```bash
npm run build:web
npm run build:mira
```

Both frontends are fully static Astro builds. `apps/web` links to Mira through `PUBLIC_MIRA_URL`, normally `https://mira.maccrate.ai/`.

## D1 / Worker boundary

Mira's authored game runs as a static frontend. Its optional shared-discovery registry remains a separate Cloudflare Worker/API under `apps/mira/registry`; that Worker—not browser or Nginx code—owns the D1 binding, migrations, validation, rate limits, and signatures. Worker deployment is intentionally separate from static Nginx deployment and requires operator-supplied Cloudflare credentials and existing resource identifiers.

No Cloudflare resources are created by the repository build.

## Release handoff

Deployment topology, environment promotion, credentials, and operator procedures are maintained in the private operations repository. This public repository intentionally documents only application builds, tests, and architecture.
