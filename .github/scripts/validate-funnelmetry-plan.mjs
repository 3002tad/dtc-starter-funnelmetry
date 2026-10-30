import { readFileSync, appendFileSync } from 'node:fs'

const [planPath, manifestPath] = process.argv.slice(2)
if (!planPath || !manifestPath) throw Error('plan and manifest paths required')
const plan = JSON.parse(readFileSync(planPath, 'utf8'))
const source = readFileSync(manifestPath, 'utf8')
const declared = key => new RegExp(`^${key}:`, 'm').test(source)
const requireStatus = (condition, message) => { if (!condition) throw Error(message) }

if (declared('cdc_shadow')) requireStatus(
  plan.capabilities?.cdcReferenceState === 'SHADOW_ONLY' &&
  plan.cdcShadowOperatorPlan?.status === 'SHADOW_ONLY_NO_RUNTIME_ACTIVATION',
  'Pinned planner does not support CDC shadow; update FUNNELMETRY_PLANNER_REF',
)
const cutover = declared('cdc_backend_cutover')
if (declared('cdc_order_v2_shadow')) requireStatus(
  plan.capabilities?.cdcOrderV2State === (cutover
    ? 'CUTOVER_DECLARED_RUNTIME_UNVERIFIED' : 'SHADOW_ONLY') &&
  plan.cdcOrderV2OperatorPlan?.status === 'SHADOW_ONLY_NO_RUNTIME_ACTIVATION',
  'Pinned planner does not support this CDC order v2 mode; update FUNNELMETRY_PLANNER_REF',
)
if (cutover) requireStatus(
  plan.capabilities?.orderPlaced === 'DISABLED' &&
  ['cdc-backend-cutover-ready', 'cdc-backend-cutover-applied'].includes(plan.integrationState) &&
  plan.manifest?.cdcBackendCutover?.profile === 'reference.medusa.order_recorded_state.v2',
  'Pinned planner does not support the reviewed backend cutover manifest',
)
if (declared('cdc_catalog_shadow')) requireStatus(
  plan.capabilities?.cdcCatalogState === 'SHADOW_ONLY',
  'Pinned planner does not support CDC catalog',
)
if (declared('cdc_inventory_price_shadow')) requireStatus(
  plan.capabilities?.cdcInventoryPriceState === 'SHADOW_ONLY',
  'Pinned planner does not support CDC inventory/price',
)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
  `source_fingerprint=${plan.sourceFingerprint}\nchange_count=${plan.changes.length}\n`)
