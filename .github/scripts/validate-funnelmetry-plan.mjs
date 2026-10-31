import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const expectedBrowserEvents = [
  'behavior.page_viewed',
  'behavior.scroll_depth_reached',
  'promotion.banner_impression',
  'promotion.banner_clicked',
  'behavior.filter_applied',
  'behavior.product_viewed',
  'checkout.started',
]
const expectedStorefrontEvents = ['behavior.search_submitted', 'cart.item_added']
const allowedStates = ['cdc-primary-cleanup-ready', 'cdc-primary', 'absent', 'exact']

function requireStatus(condition, message) {
  if (!condition) throw Error(message)
}

export function validatePlan(plan) {
  const manifest = plan.manifest ?? {}
  const capabilities = plan.capabilities ?? {}
  if (manifest.apiVersion === 'funnelmetry.io/v3') {
    requireStatus(plan.schemaVersion === 'funnelmetry-ci-plan.v3' &&
      plan.mode === 'plan-only' && plan.sourceMutation === false &&
      manifest.kind === 'InputIntegration' &&
      manifest.cdcOrderV2Shadow?.profile === 'reference.medusa.order_recorded_state.v2' &&
      manifest.cdcCatalogShadow?.profile === 'reference.medusa.catalog_master_data.v1' &&
      manifest.cdcInventoryPriceShadow?.profile === 'reference.medusa.inventory_price_context.v2' &&
      manifest.cdcCartLineItem?.profile === 'reference.medusa.cart_line_item_added.v1' &&
      manifest.cdcBackendCutover?.profile === 'reference.medusa.order_recorded_state.v2' &&
      manifest.bindings?.storefrontServer?.length === 0 &&
      manifest.bindings?.medusaBackend?.length === 0,
    'V3 plan must keep commerce on CDC and omit server message hooks')
    requireStatus([...expectedBrowserEvents, 'behavior.search_query_submitted', 'context.cart_linked']
      .every(event => manifest.bindings?.browser?.includes(event)) &&
      !manifest.bindings?.browser?.includes('behavior.search_submitted') &&
      capabilities.behavior === 'ENABLED' &&
      capabilities.cartItemPersisted === 'CDC_CONFIGURED' &&
      capabilities.searchSubmitted === 'BROWSER_SDK' &&
      capabilities.cdcCartState === 'CDC_CONFIGURED' &&
      capabilities.cdcOrderV2State === 'CDC_PRIMARY_REFERENCE' &&
      capabilities.cdcCatalogState === 'CDC_PRIMARY_REFERENCE' &&
      capabilities.cdcInventoryPriceState === 'CDC_PRIMARY_REFERENCE' &&
      capabilities.orderPlaced === 'DISABLED' &&
      allowedStates.includes(plan.integrationState),
    'V3 planner must supply the browser search and CDC cart capabilities')
    requireStatus(typeof plan.sourceFingerprint === 'string' && Array.isArray(plan.changes),
      'Planner must return a source fingerprint and change list')
    return { sourceFingerprint: plan.sourceFingerprint, changeCount: plan.changes.length }
  }
  requireStatus(plan.schemaVersion === 'funnelmetry-ci-plan.v2' &&
    plan.mode === 'plan-only' && plan.sourceMutation === false,
  'Pinned planner must return a read-only V2 integration plan')
  requireStatus(manifest.apiVersion === 'funnelmetry.io/v2' &&
    manifest.kind === 'InputIntegration' &&
    manifest.cdcOrderV2Shadow?.profile === 'reference.medusa.order_recorded_state.v2' &&
    manifest.cdcCatalogShadow?.profile === 'reference.medusa.catalog_master_data.v1' &&
    manifest.cdcInventoryPriceShadow?.profile === 'reference.medusa.inventory_price_context.v2' &&
    manifest.cdcBackendCutover?.profile === 'reference.medusa.order_recorded_state.v2' &&
    Array.isArray(manifest.bindings?.medusaBackend) &&
    manifest.bindings.medusaBackend.length === 0,
  'Manifest must use the approved CDC-primary V2 profiles without a Medusa backend message binding')
  requireStatus(expectedBrowserEvents.every(event => manifest.bindings?.browser?.includes(event)) &&
    expectedStorefrontEvents.every(event => manifest.bindings?.storefrontServer?.includes(event)) &&
    capabilities.behavior === 'ENABLED' &&
    capabilities.cartItemPersisted === 'ENABLED' &&
    capabilities.searchSubmitted === 'ENABLED',
  'Pinned planner must preserve Browser SDK and storefront behavioral bindings')
  requireStatus(capabilities.cdcReferenceState === 'RETIRED_V1' &&
    capabilities.cdcOrderV2State === 'CDC_PRIMARY_REFERENCE' &&
    capabilities.cdcCatalogState === 'CDC_PRIMARY_REFERENCE' &&
    capabilities.cdcInventoryPriceState === 'CDC_PRIMARY_REFERENCE' &&
    capabilities.orderPlaced === 'DISABLED' &&
    plan.cdcOrderV2OperatorPlan?.status === 'CDC_REFERENCE_CONFIGURED' &&
    allowedStates.includes(plan.integrationState),
  'Pinned planner does not support the approved CDC-primary contract; update FUNNELMETRY_PLANNER_REF')
  requireStatus(typeof plan.sourceFingerprint === 'string' && Array.isArray(plan.changes),
    'Planner must return a source fingerprint and change list')
  return { sourceFingerprint: plan.sourceFingerprint, changeCount: plan.changes.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planPath, manifestPath] = process.argv.slice(2)
  if (!planPath || !manifestPath) throw Error('plan and manifest paths required')
  const source = readFileSync(manifestPath, 'utf8')
  requireStatus(/^apiVersion:\s*funnelmetry\.io\/v[23]\s*$/m.test(source) &&
    !/^cdc_shadow:\s*$/m.test(source),
  'Source manifest must declare apiVersion v2/v3 and omit the retired CDC v1 profile')
  const { sourceFingerprint, changeCount } = validatePlan(JSON.parse(readFileSync(planPath, 'utf8')))
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `source_fingerprint=${sourceFingerprint}\nchange_count=${changeCount}\n`)
}
