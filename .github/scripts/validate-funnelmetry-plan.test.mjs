import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validatePlan } from './validate-funnelmetry-plan.mjs'

function approvedPlan() {
  return {
    schemaVersion: 'funnelmetry-ci-plan.v4', mode: 'plan-only', sourceMutation: false,
    sourceFingerprint: 'source-fingerprint', changes: [], integrationState: 'exact', patch: '',
    manifest: {
      apiVersion: 'funnelmetry.io/v3', kind: 'InputIntegration',
      bindings: {
        browser: [
          'behavior.page_viewed', 'behavior.scroll_depth_reached',
          'promotion.banner_impression', 'promotion.banner_clicked',
          'behavior.filter_applied', 'behavior.product_viewed',
          'behavior.search_query_submitted', 'context.cart_linked', 'checkout.started',
        ],
        storefrontServer: [], medusaBackend: [],
      },
      cdcOrderV2Shadow: { profile: 'reference.medusa.order_recorded_state.v2' },
      cdcCatalogShadow: { profile: 'reference.medusa.catalog_master_data.v1' },
      cdcInventoryPriceShadow: { profile: 'reference.medusa.inventory_price_context.v2' },
      cdcCartLineItem: { profile: 'reference.medusa.cart_line_item_added.v1' },
      cdcBackendCutover: { profile: 'reference.medusa.order_recorded_state.v2' },
    },
    capabilities: {
      behavior: 'ENABLED', searchSubmitted: 'BROWSER_SDK',
      cartItemPersisted: 'CDC_CONFIGURED', orderPlaced: 'DISABLED',
      cdcCartState: 'CDC_CONFIGURED', cdcOrderV2State: 'CDC_PRIMARY_REFERENCE',
      cdcCatalogState: 'CDC_PRIMARY_REFERENCE', cdcInventoryPriceState: 'CDC_PRIMARY_REFERENCE',
    },
  }
}

test('accepts only Browser SDK plus CDC', () => {
  assert.deepEqual(validatePlan(approvedPlan()), {
    sourceFingerprint: 'source-fingerprint', changeCount: 0,
  })
})

test('rejects server/backend bindings and retired generated code', () => {
  const binding = approvedPlan()
  binding.manifest.bindings.medusaBackend = ['legacy']
  assert.throws(() => validatePlan(binding), /without server message hooks/)
  const producer = approvedPlan()
  producer.patch = '+source_event_type: "medusa.order_placed"'
  assert.throws(() => validatePlan(producer), /retired backend producer/)
})

test('rejects a missing Browser SDK event', () => {
  const plan = approvedPlan()
  plan.manifest.bindings.browser = ['behavior.page_viewed']
  assert.throws(() => validatePlan(plan), /Browser SDK plus CDC/)
})
