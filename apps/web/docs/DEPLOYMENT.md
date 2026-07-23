# maccrate.ai — Bebop Deployment Methodology

## Status

Historical design rationale. Nothing in this document deploys to `maccrate.ai` by itself.

The repository now has Dockerfiles and static nginx configuration. Authoritative environment topology and executable deployment procedures are maintained privately; this document remains useful for public architecture and release-gate context.

## Goals

1. Preview the portfolio and Mira on real HTTPS without publishing the production domain.
2. Build once and promote the same immutable container image from preview to production.
3. Keep the portfolio and Mira as separate deployable applications.
4. Make rollback a single command.
5. Keep certificates, credentials, and environment values on Bebop—not in Git or image layers.

## Proposed topology

```text
Internet
   |
   v
Bebop host nginx (TLS termination, redirects, security headers)
   |-- preview.maccrate.ai       -> maccrate-site-preview:8080
   |-- mira-preview.maccrate.ai  -> mira-preview:4322
   |
   |-- maccrate.ai               -> maccrate-site-production:8080  [later]
   `-- mira.maccrate.ai          -> mira-production:4322            [later]
```

The portfolio and Mira remain separate containers. The portfolio receives the appropriate Mira HTTPS address at build time through `PUBLIC_MIRA_URL`.

A subdomain is preferred over hosting Mira under a path such as `/projects/mira/play/`: Astro assets, browser storage, service-worker scope, and future application routing remain isolated. Both preview hosts must use HTTPS because browser WebGPU is unavailable on ordinary HTTP custom hostnames.

## Environments

### Local

- Portfolio: `http://localhost:4321`
- Mira: `http://localhost:4322`
- Fast iteration only.
- `PUBLIC_MIRA_URL=http://localhost:4322/`

### Preview

Recommended hostnames:

- `https://preview.maccrate.ai`
- `https://mira-preview.maccrate.ai`

Preview should be protected using Cloudflare Access, an nginx allowlist, or Basic Auth. It uses the same Docker images and nginx behavior intended for production.

### Production

Reserved until explicit approval:

- `https://maccrate.ai`
- `https://mira.maccrate.ai`

No preview release automatically promotes to production.

## Container design

### Portfolio image

Use a multi-stage Dockerfile:

1. Builder stage: pinned Node image, `npm ci`, `npm run build`.
2. Runtime stage: pinned nginx image containing only `dist/` and the site nginx configuration.
3. Listen on an internal unprivileged port such as `8080`.
4. Add `/healthz` or an equivalent Docker health check.
5. Cache fingerprinted `/_astro/*` assets for one year; do not long-cache HTML.

The build receives `PUBLIC_MIRA_URL` as a build argument/environment value. It is public configuration, not a secret.

### Mira image

Keep Mira in its existing independent container. Expose it only to the shared internal Docker network; Bebop nginx owns the public port and TLS.

Mira needs:

- an HTTPS public origin;
- persistent model/browser cache behavior tested from a real client;
- no assumption that the server GPU powers browser WebGPU;
- a health endpoint or reliable HTTP readiness check.

## Source and artifact flow

Preferred long-term flow:

```text
private Git repository
        |
        v
CI builds immutable images
        |
        v
container registry (for example GHCR)
        |
        v
Bebop: docker compose pull && docker compose up -d
```

Image tags:

- immutable: Git commit SHA, e.g. `maccrate-site:1014cc8`
- optional readable alias: `preview`
- production alias only after approval: `production`

Never use `latest` as the only deployment reference.

Until a Git remote and registry exist, Bebop may build from a clean checked-out commit, but the target methodology is image promotion rather than editing files inside a running container.

## Release gates

Every preview candidate must pass:

1. Clean Git status.
2. `npm ci` succeeds from the lockfile.
3. `npm run build` passes.
4. Desktop, 390px, and 320px smoke tests pass.
5. No browser console errors.
6. Internal routes, sitemap, metadata, and 404 pass.
7. `Play Mira Machine` resolves to the preview HTTPS Mira origin.
8. Mira loads, reset works, and a complete combination path works.
9. WebGPU secure-context detection is tested from a physical client browser.
10. Preview nginx headers and certificate are inspected.

Production adds a manual approval gate and a final backup of the currently deployed image tag and Compose configuration.

## Deployment runbook

### Preview

```text
1. Commit verified source.
2. Build images tagged with the commit SHA.
3. Push images to the private registry.
4. On Bebop, update only the preview image tags.
5. docker compose pull
6. docker compose up -d --no-deps maccrate-site-preview mira-preview
7. Wait for health checks.
8. Run HTTPS smoke tests against both preview hostnames.
9. Keep the previous image tags recorded for rollback.
```

### Promotion

Do not rebuild. Point production Compose at the exact image SHA already tested in preview, run health checks, then switch/reload nginx if required.

### Rollback

```text
1. Restore the previous image tag in the environment/Compose file.
2. docker compose pull
3. docker compose up -d --no-deps <service>
4. Verify health and HTTPS.
```

No database migration is currently required for the static portfolio. Mira browser state should remain versioned so application rollback does not corrupt stored progress.

## nginx responsibilities

The host nginx layer should own:

- TLS certificates and HTTP-to-HTTPS redirects;
- hostname routing;
- HSTS only after preview validation;
- forwarded protocol/host headers;
- compression;
- body/time limits;
- security headers;
- request logs and rate limiting where useful;
- WebSocket forwarding only if a future project needs it.

The site-container nginx should own static-file behavior only.

## Secrets and configuration

Keep on Bebop:

- registry credentials;
- DNS/API credentials;
- Basic Auth or Access configuration;
- certificate private keys;
- deployment SSH keys.

Safe public build configuration:

- `PUBLIC_MIRA_URL`
- canonical public origin
- release identifier

Do not copy `.env` files into images.

## Observability

Minimum:

- Docker health status;
- host nginx access/error logs with rotation;
- container restart policy `unless-stopped`;
- disk-space monitoring;
- certificate-expiry monitoring;
- external HTTPS checks for preview and, later, production;
- deploy record containing timestamp, image SHA, and operator.

## Implementation phases

### Phase 1 — Discover Bebop

Read the existing Compose files, Docker networks, nginx virtual hosts, certificate method, directories, and current Mira service. Do not change anything.

### Phase 2 — Add repository deployment artifacts

Create and test:

- `Dockerfile`
- `.dockerignore`
- `deploy/nginx-site.conf`
- `compose.preview.yaml`
- health check
- local container smoke-test script

Replace the Cloudflare Pages deploy script with explicit container build/test commands only after the container path passes locally.

### Phase 3 — Preview HTTPS

Create protected preview hostnames and certificates, connect both containers to the proxy network, set `PUBLIC_MIRA_URL` to the Mira preview origin, and execute the release gates.

### Phase 4 — Promotion workflow

Add a private Git remote and container registry, build immutable images, document rollback, and rehearse preview rollback.

### Phase 5 — Production

Only after explicit approval, promote the exact previewed images to the production hostnames.

## Information required before implementation

- Bebop SSH/Tailscale access method available to this Hermes environment.
- Existing Docker Compose project path and service names.
- Existing nginx configuration path and proxy/container network.
- TLS/certificate method: Certbot, Cloudflare Origin Certificate, Caddy, or other.
- DNS provider and whether preview subdomains can be added.
- Preferred protected preview hostnames.
- Whether a private Git host/registry already exists.

## Recommended next move

Implement Phases 1 and 2 only: inspect Bebop read-only, then add container deployment files and prove the portfolio image locally. Do not touch DNS, nginx, or production containers until that image and rollback methodology are reviewed.
