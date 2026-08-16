# Local runtime

Docker runs PostgreSQL, Medusa and the Next.js storefront. `pnpm` is installed
only inside the runtime image; upstream code under `apps/` has no Docker or
Edge-runtime patch.

```powershell
docker compose -f runtime/docker-compose.yml up -d --build
```

Create `apps/storefront/.env.local` from `runtime/storefront.env.example`, then
set its publishable key from Medusa Admin. The storefront is available at
`http://localhost:8000/dk`; Medusa Admin is at `http://localhost:9000/app`.

The Compose volume is retained when services stop, so seed data survives. Use
`docker compose -f runtime/docker-compose.yml down -v` only for an intentional
local database reset.
