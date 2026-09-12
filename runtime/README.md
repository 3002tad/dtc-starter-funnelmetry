# Local runtime

Docker runs PostgreSQL, Redis, a compiled Medusa Admin/backend and a compiled Next.js
storefront. `pnpm` is installed only inside the runtime image; upstream code
under `apps/` has no Docker or Edge-runtime patch. The backend runs `medusa
start`, while the storefront is built by `next build` and runs with `next start`;
the reference environment does not run Vite or Turbopack development servers.
The backend runs the bundle under `apps/backend/.medusa/server`, which is
created during the image build.

Redis is private to the Docker network and persisted in the `redis_data` named
volume. Medusa uses it for server sessions, the Redis event bus and workflow
engine; it is not exposed through a host port. The `REDIS_URL` and
`REDIS_PREFIX` environment variables are backend runtime configuration, not
Storefront build arguments.
The local Compose profile explicitly permits an insecure session cookie for
`http://localhost`; deployments must omit that override and use HTTPS.

The private Funnelmetry packages are resolved while building the image. Export a
GitHub token with read-only `read:packages` access; Docker mounts it as a BuildKit
secret and does not store it in an image layer:

```powershell
$env:FUNNELMETRY_PACKAGE_READ_TOKEN = "<read-only-package-token>"
```

`NEXT_PUBLIC_*` variables are inlined into the browser bundle during `next
build`. Provide the public storefront values to Compose **at build time**. For
local development, the non-secret `.env.local` may be used as the Compose env
file:

```powershell
docker compose --env-file apps/storefront/.env.local -f runtime/docker-compose.yml up -d --build
```

For a server deployment, put the public backend URL, Medusa publishable key,
default region and optional Funnelmetry browser write key in the server's
non-versioned Compose env file, then pass it with `--env-file`. The backend
signing key remains runtime-only and must not be passed as a Docker build arg.

Create `apps/storefront/.env.local` from `runtime/storefront.env.example`, then
set its publishable key from Medusa Admin. The storefront is available at
`http://localhost:8000/dk`; Medusa Admin is at `http://localhost:9000/app`.

The Compose volume is retained when services stop, so seed data survives. Use
`docker compose -f runtime/docker-compose.yml down -v` only for an intentional
local database reset.

The Funnelmetry API bot is a one-shot container in the optional
`funnelmetry-test` Compose profile. It is not part of the long-running Medusa
runtime. See [`../docs/RUN_FUNNELMETRY_API_BOT.md`](../docs/RUN_FUNNELMETRY_API_BOT.md)
for the build command, required public credentials and full source-funnel test.
