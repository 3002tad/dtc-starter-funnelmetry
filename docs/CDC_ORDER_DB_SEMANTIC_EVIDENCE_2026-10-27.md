# CDC order semantics — first evidence pass (2026-10-27)

Status: **IN PROGRESS / UNVERIFIED for CDC `order.placed` equivalence**. This is source-side evidence for DEC-135 development, not a new source event contract or live cutover approval.

## Environment and method

- VPS `kltn` runs Medusa Reference commit `efc7a58` on `funnelmetry/integration/medusa-reference-input-v1`, with Medusa/core-flows `2.19.0` and PostgreSQL `15.19`.
- Inspected installed `@medusajs/core-flows/dist/cart/workflows/complete-cart.js` inside the running backend container, local Funnelmetry subscriber, PostgreSQL schema/config and aggregate row counts. Performed one controlled test checkout with a synthetic address and the configured Manual Payment provider. No source code, PostgreSQL replication setting, slot or live CDC consumer was changed.
- PostgreSQL has `wal_level=replica` and zero replication slots. This pass observes workflow declarations and persisted schema, not WAL commit order.

## Native workflow and source event

The installed `complete-cart` workflow first checks for an existing `order_cart` link for the cart. If no order exists, it creates an order with status `pending`. It then declares `createRemoteLinkStep` for Order↔Cart, `updateCartsStep` setting `completed_at`, inventory reservation, promotion usage, and `emitEventStep(OrderWorkflowEvents.PLACED)` in the same `parallelize` group. Payment authorization and optional order transaction creation appear **after** that group. The workflow can compensate after a later failure. Source locations in the installed package: `complete-cart.js` lines 303–349, 440–460, 475–480, 509–540, 554–587.

Crucially, the installed `emit-event.js` states that grouped events are emitted **only after the workflow finishes successfully** and are cleared on compensation/failure; its implementation uses an event group ID and `clearGroupedEvents` on compensation. Thus the placement of `emitEventStep` in workflow code is not the external event's occurrence time. Source location: `@medusajs/core-flows/dist/common/steps/emit-event.js` lines 7–12, 40–75. The exact DB transaction or persisted workflow state that can serve as a CDC success marker remains unverified.

The Funnelmetry subscriber listens to native `order.placed`, then queries Order Graph for `created_at`, `currency_code`, `total`, items and `cart.id`. It emits `medusa.order_placed` schema `2.0` with stable event ID `medusa:order.placed:<orderId>` and correlation `cart:<cartId>` only if those fields are available. See `apps/backend/src/subscribers/funnelmetry-order-placed.ts`.

## Candidate DB evidence matrix

| DB observation | Schema/workflow evidence | Can it alone prove native `order.placed`? |
|---|---|---|
| `order` insert with `status=pending` | `createOrdersStep` precedes the event group | **No**. A later step or payment authorization can fail. |
| `order_cart` link insert | Physical link table has PK `(order_id, cart_id)`; link creation is in the same parallel group as the placed-event step | **UNVERIFIED**. A link may exist before workflow success and later be compensated. |
| `cart.completed_at` update | Declared in the same parallel group as the placed-event step | **UNVERIFIED**. It may be committed before successful payment authorization and later compensated. |
| `order_summary.totals` | Physical JSONB source for order totals; `order` table has currency but no simple `total` column | **No** as an occurrence marker. Must prove Query Graph `order.total` equivalence separately. |
| `order_transaction` insert | Declared after payment authorization, before workflow success/event release, but only for the captures returned by the payment | **No** as a universal placed marker; an authorized-only payment may have no such transaction. |
| `workflow_execution.state` | Framework table exists; successful test left a `complete-cart` row with `state=done`, `context.data.payload.id=<cartId>` and retention 259200 seconds | **UNVERIFIED** and version-coupled; not an approved CDC table. One successful row does not establish behavior on retries/failure or event-release/commit order. |

The physical schema also has `order_item`, `order_line_item` and `order_summary`. `order.status` permits `pending`, `completed`, `draft`, `archived`, `canceled` and `requires_action`; status membership alone is not a validated placed-event transition.

## Controlled checkout and observed successful case

An Edge session on `https://shop.entidi.io.vn` accepted tracking, added one low-value catalog item to a new cart and submitted a synthetic shipping address. Initially the Store API returned zero shipping options because the cart's sales channel was not linked to the stock location. The operator linked the correct channel in Medusa Admin; the Store API then returned two options. The storefront still rendered an empty delivery option list for the same cart (consistent with a stale cached response, not yet root-caused). To complete this controlled test without changing storefront code, Standard Shipping was attached to that cart through the existing Store API, and the browser proceeded through Payment and Review with Manual Payment. The storefront confirmed one order.

Observed at placement on 2026-10-27 UTC, on the deployed source stated above:

| Observation | Value / comparison |
|---|---|
| Confirmed order / cart | `order_01M5XWG33TD2A4EGX94NYA3EQZ` / `cart_01M5XVYEXZ1VF38ZP485CQAQRC` |
| DB `order` | One row; `status=pending`, `currency_code=eur`, `created_at=05:14:30.401Z` |
| DB `order_cart` and cart | One matching link; `cart.completed_at=05:14:30.487Z` |
| DB `order_summary.totals` | `current_order_total=15.51`, `original_order_total=15.51`, `paid_total=0`, `pending_difference=15.51` |
| DB item | One `order_item` joined to `order_line_item`; quantity 1, product and variant match the source event, line-item unit price 5.51 |
| DB `workflow_execution` | One `complete-cart` row, `state=done`, payload cart ID matches; `updated_at=05:14:30.622Z`, retention 259200 seconds |
| Source Event Feed | Exactly one matching `medusa.order_placed` in the 42-record feed snapshot, `ingress_seq=39`, accepted at `05:14:30.761Z` |
| Event identity/correlation | `event_id=medusa:order.placed:<orderId>`, `correlation_id=cart:<cartId>`, both match DB |
| Event amount/time | `currency_code=eur`, `total_amount=15.51`, `amount_unit=major`, `amount_semantics=medusa.order.total`; `occurred_at=05:14:30.401Z`, matching `order.created_at` |

The event's amount agrees with the final `order_summary` for this **simple** order, but a general formula for discounts, tax, shipping adjustments, refunds or later order edits has not been proven. `order.status=pending` and `paid_total=0` despite `order.placed`: placement is not payment capture. The event's `occurred_at` uses order creation time, while Feed acceptance occurs after the workflow's `done` update in this observed case. These wall-clock timestamps do **not** establish WAL transaction order or prove that a CDC consumer can safely emit at a given DB transition.

## Operator capture after placement

The operator subsequently used **Capture payment** in Medusa Admin for the same test order. A read-only DB and Event Feed check after that action found:

| Observation | Value / comparison |
|---|---|
| `capture` joined through `payment` and `order_payment_collection` | One capture, amount 15.51 in the order's EUR currency, created `2026-10-27 05:23:33.065Z`; provider `pp_system_default` (Manual Payment) |
| `payment` / `payment_collection` | `payment.captured_at=05:23:33.071Z`; collection `status=completed` |
| `order_transaction` | One row for the order, amount 15.51, created `05:23:33.145Z`; there was no transaction for this order before capture |
| `order_summary.totals` | `paid_total` and `transaction_total` changed from 0 to 15.51; `pending_difference` changed from 15.51 to 0; `current_order_total` remained 15.51 |
| `order` | `status=pending` and original `created_at` remained unchanged; payment state is not inferred from order status |
| Source Event Feed | At inspection, latest sequence was 42. Records 40–42 were behavioral events; no new `medusa.order_placed` or payment business event was emitted by the current Funnelmetry source integration for this capture |

This is a distinct **payment capture transition** roughly nine minutes after `order.placed`, not a second conversion or a correction to the placed-order amount. Manual Payment gives a Medusa test-state record; it does not prove transfer of real funds. For CDC, capture/payment/order-transaction rows are candidates for a separate payment lifecycle mapping, with their own identity, source time, amount and dedup rules. No `payment.captured` Funnelmetry contract or CDC mapping is approved from this single observation.

## Operator fulfillment and delivery after capture

The operator then completed fulfillment and marked the same test order as delivered in Medusa Admin. A read-only DB and Event Feed check found:

| Observation | Value / comparison |
|---|---|
| `order_fulfillment` | One link from the same order to `ful_01M5XX77J7KNAQSJDJJCYGXTKR`, created `2026-10-27 05:27:08.655Z` |
| `fulfillment` | Provider `manual_manual`; `created_at=05:27:08.616Z`, `packed_at=05:27:08.593Z`, `delivered_at=05:27:32.679Z`; `shipped_at` and `canceled_at` are null |
| `fulfillment_item` | One row for the fulfillment, quantity 1 |
| `order` | `status=pending` remained unchanged; `updated_at=05:27:32.768Z` |
| Source Event Feed | `GET /v1/events?after_seq=42` returned zero records, `next_after_seq=42`; the current Funnelmetry source integration did not emit fulfillment/delivery business events for these Admin actions |

`delivered_at` is observable persisted state for this test, whereas a distinct `shipped_at` transition is **absent**. Do not synthesize a shipped event from delivery or use `order.status` as fulfillment status. A future CDC fulfillment/delivery mapping needs separate source semantics, order–fulfillment linkage, handling for partial/multiple fulfillments and reversals, and validation against Medusa's native lifecycle. This test does not approve such a mapping or extend the current Pipeline event catalog.

## Required next evidence

1. Exercise a failed checkout that reaches order creation or later payment authorization in an isolated test environment; establish whether a committed create/link/update is compensated while the grouped native `order.placed` event is withheld. A simple form-validation failure before order creation is insufficient.
2. Compare more cases (discounts, tax, shipping adjustments, retries) against Medusa Order Graph/API and `order_summary`, not just this simple successful order.
3. Capture transaction/LSN order in an **isolated shadow PostgreSQL** configured for logical replication. Do not infer commit order from workflow code or final DB snapshot.
4. Keep CDC mapping `UNVERIFIED` until a candidate predicate has zero false conversions/misses in the declared cases. If no DB predicate matches the native event, retain the subscriber as order-fact authority and use CDC for entity state.
