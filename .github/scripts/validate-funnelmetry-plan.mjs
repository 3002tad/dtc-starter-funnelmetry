import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const expectedBrowserEvents = [
  'behavior.page_viewed', 'behavior.scroll_depth_reached',
  'promotion.banner_impression', 'promotion.banner_clicked',
  'behavior.filter_applied', 'behavior.product_viewed',
  'behavior.search_query_submitted', 'context.cart_linked', 'checkout.started',
]

function requireStatus(condition, message) {
  if (!condition) throw Error(message)
}

export function validatePlan(plan) {
  const manifest = plan.manifest ?? {}
  const capabilities = plan.capabilities ?? {}
  requireStatus(plan.schemaVersion === 'funnelmetry-ci-plan.v4' &&
    plan.mode === 'plan-only' && plan.sourceMutation === false &&
    manifest.apiVersion === 'funnelmetry.io/v3' && manifest.kind === 'InputIntegration',
  'Pinned planner must return the V3 two-path plan contract')
  requireStatus(manifest.cdcOrderV2Shadow?.profile === 'reference.medusa.order_recorded_state.v2' &&
    manifest.cdcCatalogShadow?.profile === 'reference.medusa.catalog_master_data.v1' &&
    manifest.cdcInventoryPriceShadow?.profile === 'reference.medusa.inventory_price_context.v2' &&
    manifest.cdcCartLineItem?.profile === 'reference.medusa.cart_line_item_added.v1' &&
    manifest.cdcBackendCutover?.profile === 'reference.medusa.order_recorded_state.v2',
  'V3 plan must contain every approved CDC profile')
  requireStatus(manifest.bindings?.storefrontServer?.length === 0 &&
    manifest.bindings?.medusaBackend?.length === 0 &&
    expectedBrowserEvents.every(event => manifest.bindings?.browser?.includes(event)),
  'V3 plan must use Browser SDK plus CDC without server message hooks')
  requireStatus(capabilities.behavior === 'ENABLED' &&
    capabilities.searchSubmitted === 'BROWSER_SDK' &&
    capabilities.cartItemPersisted === 'CDC_CONFIGURED' &&
    capabilities.orderPlaced === 'DISABLED' &&
    capabilities.cdcCartState === 'CDC_CONFIGURED' &&
    capabilities.cdcOrderV2State === 'CDC_PRIMARY_REFERENCE' &&
    capabilities.cdcCatalogState === 'CDC_PRIMARY_REFERENCE' &&
    capabilities.cdcInventoryPriceState === 'CDC_PRIMARY_REFERENCE',
  'V3 capabilities must describe two-path acquisition')
  requireStatus(typeof plan.sourceFingerprint === 'string' && Array.isArray(plan.changes),
    'Planner must return a source fingerprint and change list')
  const addedPatchLines = String(plan.patch ?? '').split('\n')
    .filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n')
  requireStatus(!/backend-integration-kit|medusa\.order_placed|behavior\.search_submitted|server-delivery\.ts/.test(addedPatchLines),
    'Plan must not generate a retired backend producer')
  return { sourceFingerprint: plan.sourceFingerprint, changeCount: plan.changes.length }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [planPath, manifestPath] = process.argv.slice(2)
  if (!planPath || !manifestPath) throw Error('plan and manifest paths required')
  const source = readFileSync(manifestPath, 'utf8')
  requireStatus(/^apiVersion:\s*funnelmetry\.io\/v3\s*$/m.test(source) &&
    !/^cdc_shadow:\s*$/m.test(source),
  'Source manifest must declare V3 and omit retired CDC v1')
  const result = validatePlan(JSON.parse(readFileSync(planPath, 'utf8')))
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `source_fingerprint=${result.sourceFingerprint}\nchange_count=${result.changeCount}\n`)
}
