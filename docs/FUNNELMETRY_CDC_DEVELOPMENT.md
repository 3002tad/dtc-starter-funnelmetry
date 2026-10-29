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

The current manifest and generated code continue to emit `medusa.order_placed` through the native `order.placed` subscriber. Browser SDK, consent, `behavior.search_submitted`, and `cart.item_added` stay installed. CDC development first generates a separate shadow capture/profile; it does not disable the subscriber or write a second authoritative `order.placed` to the Pipeline.

Source PostgreSQL logical settings, replication role, publication and network attachment require a separately identified source owner and test environment. Secrets remain outside Git and the manifest. The installer must plan and verify these requirements and provide rollback artifacts; it must not silently change the live PostgreSQL instance.

The first conformance gate compares committed database changes with the native subscriber for successful/failed/retried checkouts, `order_cart` correlation, `order_summary` versus Query Graph amount, currency, occurrence time, snapshot handling and duplicates. Only after that evidence and a cutover/rollback decision may the installer offer a CDC-primary profile that removes its own order subscriber. See the development contract at `Streaming_Pipeline/tools/medusa-ci-installer/CDC_DEVELOPMENT.md` in the workspace.
