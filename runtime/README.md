# Local runtime

Docker provides PostgreSQL and Redis only. The Medusa backend and Next.js
storefront run directly from upstream source, so no Docker or Edge runtime
source patch is required.

```powershell
docker compose -f runtime/docker-compose.yml up -d
```

Create `apps/backend/.env` from `runtime/backend.env.example`, then run
`pnpm dev` from `apps/backend`. Create `apps/storefront/.env.local` from
`runtime/storefront.env.example`, fill in a publishable key created in Medusa
Admin, then run `pnpm dev` from `apps/storefront`.

The Compose volume is retained when services stop, so seed data survives. Use
`docker compose -f runtime/docker-compose.yml down -v` only for an intentional
local database reset.
