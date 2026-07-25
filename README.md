# maccrate.ai monorepo

Canonical source for the MacCrate portfolio and its independently deployed projects.

## Structure

```text
apps/
  web/   # portfolio site
  mira/  # Mira game (see apps/mira/README.md)
projects/
  hello-world-ai-fine-tuning/  # public notebook, datasets, and retained evidence
```

Deployable experiences belong under `apps/<project-name>/` and can have their own domain, build, tests, and runtime architecture. Research and article evidence that should be published with the portfolio belongs under `projects/<project-name>/`. Both share one Git history and deployment repository.

## Build contract

- Node.js 20
- Install everything: `npm ci`
- Build everything: `npm run build`

Each app under `apps/` produces its own static output. Run `npm run build:<app>` for targeted builds. Refer to each app's README.md for build-specific details.

## Release handoff

Deployment topology, environment promotion, credentials, and operator procedures are maintained in the private operations repository. This public repository intentionally documents only application builds, tests, and architecture.
