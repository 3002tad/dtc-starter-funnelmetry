# Local runtime

Docker runs PostgreSQL, a compiled Medusa Admin/backend and the Next.js
storefront. `pnpm` is installed only inside the runtime image; upstream code
under `apps/` has no Docker or Edge-runtime patch. The backend runs `medusa
start`, not `medusa develop`, so the reference environment does not depend on
the Vite development server at runtime. It runs the bundle under
`apps/backend/.medusa/server`, which is created during the image build.
The local Compose profile explicitly permits an insecure session cookie for
`http://localhost`; deployments must omit that override and use HTTPS.

The private Funnelmetry packages are resolved while building the image. Export a
GitHub token with read-only `read:packages` access; Docker mounts it as a BuildKit
secret and does not store it in an image layer:

```powershell
$env:FUNNELMETRY_PACKAGE_READ_TOKEN = "<read-only-package-token>"
```

```powershell
docker compose -f runtime/docker-compose.yml up -d --build
```

Create `apps/storefront/.env.local` from `runtime/storefront.env.example`, then
set its publishable key from Medusa Admin. The storefront is available at
`http://localhost:8000/dk`; Medusa Admin is at `http://localhost:9000/app`.

The Compose volume is retained when services stop, so seed data survives. Use
`docker compose -f runtime/docker-compose.yml down -v` only for an intentional
local database reset.
