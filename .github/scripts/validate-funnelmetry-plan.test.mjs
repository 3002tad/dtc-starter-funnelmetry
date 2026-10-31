import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validatePlan } from './validate-funnelmetry-plan.mjs'

function approvedPlan() {
  return {
    schemaVersion: 'funnelmetry-ci-plan.v2',
    mode: 'plan-only',
    sourceMutation: false,
    sourceFingerprint: 'source-fingerprint',
    changes: [],
    integrationState: 'exact',
    cdcOrderV2OperatorPlan: { status: 'CDC_REFERENCE_CONFIGURED' },
    manifest: {
      apiVersion: 'funnelmetry.io/v2',
      kind: 'InputIntegration',
      bindings: {
        browser: [
          'behavior.page_viewed', 'behavior.scroll_depth_reached',
          'promotion.banner_impression', 'promotion.banner_clicked',
          'behavior.filter_applied', 'behavior.product_viewed', 'checkout.started',
        ],
        storefrontServer: ['behavior.search_submitted', 'cart.item_added'],
        medusaBackend: [],
      },
      cdcOrderV2Shadow: { profile: 'reference.medusa.order_recorded_state.v2' },
      cdcCatalogShadow: { profile: 'reference.medusa.catalog_master_data.v1' },
      cdcInventoryPriceShadow: { profile: 'reference.medusa.inventory_price_context.v2' },
      cdcBackendCutover: { profile: 'reference.medusa.order_recorded_state.v2' },
    },
    capabilities: {
      behavior: 'ENABLED',
      cartItemPersisted: 'ENABLED',
      searchSubmitted: 'ENABLED',
      cdcReferenceState: 'RETIRED_V1',
      cdcOrderV2State: 'CDC_PRIMARY_REFERENCE',
      cdcCatalogState: 'CDC_PRIMARY_REFERENCE',
      cdcInventoryPriceState: 'CDC_PRIMARY_REFERENCE',
      orderPlaced: 'DISABLED',
    },
  }
}

test('accepts a CDC-primary plan that preserves browser and storefront tracking', () => {
  assert.deepEqual(validatePlan(approvedPlan()), {
    sourceFingerprint: 'source-fingerprint', changeCount: 0,
  })
})

test('rejects a plan that reintroduces the Medusa backend message', () => {
  const plan = approvedPlan()
  plan.manifest.bindings.medusaBackend = ['medusa.order_placed']
  assert.throws(() => validatePlan(plan), /CDC-primary V2 profiles/)
})

test('rejects a plan missing a browser or storefront event', () => {
  const plan = approvedPlan()
  plan.manifest.bindings.browser = ['behavior.page_viewed']
  assert.throws(() => validatePlan(plan), /Browser SDK/)
})

test('rejects a planner reporting an inactive CDC catalog', () => {
  const plan = approvedPlan()
  plan.capabilities.cdcCatalogState = 'NOT_REQUESTED'
  assert.throws(() => validatePlan(plan), /CDC-primary contract/)
})
