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

The private Funnelmetry packages are resolved while building the image. Export
`NODE_AUTH_TOKEN` with `read:packages` access; Docker mounts it as a BuildKit
secret and does not store it in an image layer:

```powershell
$env:NODE_AUTH_TOKEN = "<read-only-package-token>"
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
It is injected at runtime into both the Medusa backend and storefront server:
the storefront uses it only for the server-side search/cart dispatcher and it
must never use a `NEXT_PUBLIC_*` name.

When Source Ingress runs in another Compose project on a Linux deployment,
connect the storefront to that project's external Docker network and use its
service DNS name for `FUNNELMETRY_INGEST_URL` (for example,
`http://source-ingress:32000/v1/ingress/events`). A port published only to
the host loopback interface (`127.0.0.1`) is not reachable through
`host.docker.internal` from a Linux container.

`runtime/docker-compose.source-ingress.example.yml` is the corresponding
server override. Copy it as a non-versioned server override, change the
external network name when necessary, and include it after
`runtime/docker-compose.yml` in every Compose command.
It also sets `restart: unless-stopped` for PostgreSQL, Redis, backend, and
storefront so a Docker daemon restart during a host upgrade brings the site
back without a manual Compose start. Keep this policy in the server override
when adapting the example.

For a separately approved CDC shadow rehearsal, the source owner can include
`runtime/docker-compose.cdc-shadow.example.yml` after the base and site
overrides. Set `CDC_SOURCE_NETWORK` to the pre-created private, attachable
Docker overlay shared with the Pipeline Connect service. The override keeps
PostgreSQL on Medusa's default network and adds the unambiguous
`medusa-cdc-postgres` alias on the CDC network; Connect must use that alias
rather than `postgres`, which also names the Pipeline database. Its host port
remains bound to `127.0.0.1`. The override does not enable logical WAL,
create a replication role or activate a connector. Backup/restore, WAL budget,
DB credentials and the source-owner restart plan remain separate gates under
DEC-135. `docker compose config` checks syntax only; it does not attach a
running container or verify network access.

For a separately reviewed logical-WAL shadow rollout, add
`runtime/docker-compose.cdc-logical.example.yml` **after** the network
override. It changes only the PostgreSQL command and requires the source owner
to provide a finite, positive `CDC_MAX_SLOT_WAL_KEEP_MB`; the repository does
not choose a WAL retention budget. The current `max_replication_slots` and
`max_wal_senders` must be checked against the three CDC profiles before use.
Run the rendered-config guard before recreating PostgreSQL:

```bash
set -o pipefail
export CDC_SOURCE_NETWORK=<private-overlay-name>
export CDC_MAX_SLOT_WAL_KEEP_MB=<reviewed-positive-MiB-cap>
docker compose --env-file <site-env> \
  -f runtime/docker-compose.yml -f <site-override> \
  -f runtime/docker-compose.cdc-shadow.example.yml \
  -f runtime/docker-compose.cdc-logical.example.yml \
  config --format json | node runtime/check-cdc-source-config.mjs
```

The guard checks the finite cap, exact PostgreSQL command, private network
alias, loopback port and persisted volume without printing the rendered secrets.
An accepted config does not authorize a restart: first record the source-owner
approval, backup/restore result, workload-based WAL budget, health checks and
rollback window. Then use the **same four Compose files** for a controlled
`up -d --no-deps --no-build postgres`, verify `SHOW wal_level` and
`SHOW max_slot_wal_keep_size`, confirm Medusa health and the existing volume,
and only then create the three narrow roles/publications/slots. Keep the
native order subscriber and `catalog-sync` authoritative during shadow.

Create `apps/storefront/.env.local` from `runtime/storefront.env.example`, then
set its publishable key from Medusa Admin. The storefront is available at
`http://localhost:8000/dk`; Medusa Admin is at `http://localhost:9000/app`.

The Compose volume is retained when services stop, so seed data survives. Use
`docker compose -f runtime/docker-compose.yml down -v` only for an intentional
local database reset.
