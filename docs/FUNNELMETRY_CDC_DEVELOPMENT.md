# Funnelmetry CDC integration branch

Status: **IN DEVELOPMENT / SHADOW ONLY** under DEC-135. This branch is `feature/cdc-medusa-v1`, based on `funnelmetry/integration/medusa-reference-input-v1`. It is not the deployed Medusa integration branch.

The CDC work extends the configuration-driven Medusa CI installer in Streaming Pipeline. A clean checkout of this exact Medusa version must be integrable from `funnelmetry.integration.yaml` and a pinned installer version; hand-edited Medusa core code is not an installation method.

The manifest also declares `cdc_order_v2_shadow` for an explicit new coverage
epoch. The Pipeline planner generates only
`funnelmetry/cdc-order-v2-shadow.json`; no source subscriber or PostgreSQL
setting is changed. The order v1 artifact remains separate. CI must pin a
planner commit that reports `cdcOrderV2State=SHADOW_ONLY`; the plan/propose
workflows reject an older planner. Runtime operator setup and CDC-12 authority
remain separate gates.

Catalog stage 1 and inventory/price stage 2 now also declare distinct
`coverage_epoch_id` values in `funnelmetry.integration.yaml`. The installer
upgrades only its exact generated catalog v1 and inventory/price v2 profile
files to artifact schemas v2 and v3, preserving the catalog v1 and context v2
business contracts. The generated epochs must match the Pipeline shadow
worker configuration. The current planner pin must be updated to a reviewed
commit supporting those fields before CI runs; no source DB setting or native
Medusa event binding is changed by this profile upgrade.

The current manifest and generated code continue to emit `medusa.order_placed` through the native `order.placed` subscriber. Browser SDK, consent, `behavior.search_submitted`, and `cart.item_added` stay installed. CDC development first generates a separate shadow capture/profile; it does not disable the subscriber or write a second authoritative `order.placed` to the Pipeline.

Source PostgreSQL logical settings, replication role, publication and network attachment require a separately identified source owner and test environment. Secrets remain outside Git and the manifest. The installer must plan and verify these requirements and provide rollback artifacts; it must not silently change the live PostgreSQL instance.

`runtime/docker-compose.cdc-shadow.example.yml` is a source-owner network
override template. It adds only the external `CDC_SOURCE_NETWORK` to
PostgreSQL with alias `medusa-cdc-postgres`, retaining Medusa's default network
and localhost host port. It is not included by default and must not be treated
as permission to restart the deployed database or change `wal_level`.

`runtime/docker-compose.cdc-logical.example.yml` is a separate, optional
source-owner command override for target-topology shadow testing. It requires
an explicit positive MiB WAL cap rather than carrying a clone/default value.
`runtime/check-cdc-source-config.mjs` validates the rendered command,
network alias, loopback-only port and persistent volume before rollout; it
does not create a role, publication, slot or connector. The source backup and
isolated restore test, runtime cap and controlled restart remain operator
gates. See `runtime/README.md` for the exact file order and preflight command.

On the KLTN shadow VPS, the source owner approved a controlled PostgreSQL
restart on 2026-10-30. The network and logical-WAL overrides were copied
outside the live checkout, the rendered-config guard passed with a provisional
1024 MiB cap, and PostgreSQL restarted healthy with `wal_level=logical` and
`max_slot_wal_keep_size=1GB`. The existing `postgres_data` volume, loopback
port and Medusa default network remained; the backend health endpoint returned
200 and product count remained 104. This cap is a **shadow operating limit**,
not a flash-sale/production capacity claim. No role, publication, slot or
connector has been created and no analytical authority has changed.

The first conformance gate compares committed database changes with the native subscriber for successful/failed/retried checkouts, `order_cart` correlation, `order_summary` versus Query Graph amount, currency, occurrence time, snapshot handling and duplicates. Only after that evidence and a cutover/rollback decision may the installer offer a CDC-primary profile that removes its own order subscriber. See the development contract at `Streaming_Pipeline/tools/medusa-ci-installer/CDC_DEVELOPMENT.md` in the workspace.
