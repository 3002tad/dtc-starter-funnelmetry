import { readFileSync, appendFileSync } from 'node:fs'

const [planPath, manifestPath] = process.argv.slice(2)
if (!planPath || !manifestPath) throw Error('plan and manifest paths required')
const plan = JSON.parse(readFileSync(planPath, 'utf8'))
const source = readFileSync(manifestPath, 'utf8')
const declared = key => new RegExp(`^${key}:`, 'm').test(source)
const requireStatus = (condition, message) => { if (!condition) throw Error(message) }

requireStatus(!declared('cdc_shadow') && declared('cdc_backend_cutover') &&
  declared('cdc_order_v2_shadow') && declared('cdc_catalog_shadow') &&
  declared('cdc_inventory_price_shadow'),
  'CDC primary manifest must declare all three CDC profiles and no v1 shadow',
)
requireStatus(
  plan.capabilities?.cdcReferenceState === 'RETIRED_V1' &&
  plan.capabilities?.cdcOrderV2State === 'CDC_PRIMARY_REFERENCE' &&
  plan.cdcOrderV2OperatorPlan?.status === 'CDC_REFERENCE_CONFIGURED',
  'Pinned planner does not support CDC primary; update FUNNELMETRY_PLANNER_REF',
)
requireStatus(
  plan.capabilities?.orderPlaced === 'DISABLED' &&
  ['cdc-primary-cleanup-ready', 'cdc-primary', 'absent', 'exact'].includes(plan.integrationState) &&
  plan.manifest?.cdcBackendCutover?.profile === 'reference.medusa.order_recorded_state.v2',
  'Pinned planner does not support the approved CDC primary contract',
)
requireStatus(
  plan.capabilities?.cdcCatalogState === 'CDC_PRIMARY_REFERENCE',
  'Pinned planner does not support CDC catalog',
)
requireStatus(
  plan.capabilities?.cdcInventoryPriceState === 'CDC_PRIMARY_REFERENCE',
  'Pinned planner does not support CDC inventory/price',
)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
  `source_fingerprint=${plan.sourceFingerprint}\nchange_count=${plan.changes.length}\n`)
