import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createManagedDeliveryDispatcher } from "../funnelmetry/managed-delivery-dispatcher"
import { normalizeOccurredAt } from "../funnelmetry/occurred-at"

type OrderPlacedData = { id: string }
type OrderItem = { product_id?: string; variant_id?: string; quantity?: number; unit_price?: unknown }
type LinkedCart = { id?: string }
type Order = { id: string; created_at?: string | Date; currency_code?: string; total?: unknown; items?: OrderItem[]; cart?: LinkedCart | LinkedCart[] }
type Query = { graph: (input: Record<string, unknown>) => Promise<{ data: Order[] }> }
type Logger = { warn: (message: string) => void }
type MedusaContainer = SubscriberArgs<OrderPlacedData>["container"]

const sourceId = "medusa-reference"
const sourceKeyId = "medusa-reference-source"
const reliability = {"failureMode":"fail_open","timeoutMs":800,"maxQueueSize":200,"retry":{"maxAttempts":3},"circuitBreaker":{"failureThreshold":3,"cooldownMs":30000}}
let dispatcher: ReturnType<typeof createManagedDeliveryDispatcher> | undefined
let lastInactiveWarningAt = 0

function linkedCartId(order: Order) {
  const cart = Array.isArray(order.cart) ? order.cart[0] : order.cart
  return typeof cart?.id === "string" && cart.id.length > 0 ? cart.id : null
}

function getDispatcher(logger: Logger) {
  if (dispatcher) return dispatcher
  const signingKey = process.env.FUNNELMETRY_BACKEND_SIGNING_KEY ?? ""
  if (!signingKey) {
    if (Date.now() - lastInactiveWarningAt >= 60000) {
      lastInactiveWarningAt = Date.now()
      logger.warn("Funnelmetry backend integration is inactive: signing key is not configured")
    }
    return null
  }
  dispatcher = createManagedDeliveryDispatcher({
    sourceId,
    sourceKeyId,
    endpoint: "http://source-ingress:32000/v1/ingress/events",
    signingKey,
    timeoutMs: reliability.timeoutMs,
    maxAttempts: reliability.retry.maxAttempts,
    maxQueueSize: reliability.maxQueueSize,
    failureThreshold: reliability.circuitBreaker.failureThreshold,
    cooldownMs: reliability.circuitBreaker.cooldownMs,
    logger,
  })
  return dispatcher
}

async function enqueueOrderPlaced(orderId: string, container: MedusaContainer, logger: Logger) {
  try {
    const { normalizeCurrencyCode, normalizeMajorAmount } = await import("@3002tad/funnelmetry-backend-integration-kit")
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as Query
    const { data } = await query.graph({ entity: "order", fields: ["id", "created_at", "currency_code", "total", "items.product_id", "items.variant_id", "items.quantity", "items.unit_price", "cart.id"], filters: { id: orderId } })
    const order = data[0]
    const occurredAt = normalizeOccurredAt(order?.created_at)
    const currencyCode = normalizeCurrencyCode(order?.currency_code)
    const totalAmount = normalizeMajorAmount(order?.total)
    const cartId = order ? linkedCartId(order) : null
    if (!order || !occurredAt || !currencyCode || !totalAmount || !cartId) {
      logger.warn("Funnelmetry order forward skipped: missing authoritative order/cart/time/amount/currency")
      return
    }
    getDispatcher(logger)?.enqueue({
      eventId: `medusa:order.placed:${orderId}`,
      sourceEventType: "medusa.order_placed",
      occurredAt,
      sourceSchemaVersion: "2.0",
      aggregate: { type: "order", id: order.id },
      correlationId: `cart:${cartId}`,
      sourcePayload: { order_id: order.id, cart_id: cartId, currency_code: currencyCode, total_amount: totalAmount, amount_unit: "major", amount_semantics: "medusa.order.total", items: (order.items ?? []).map((item) => { const unitPriceAmount = normalizeMajorAmount(item.unit_price); return { product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity, ...(unitPriceAmount ? { unit_price_amount: unitPriceAmount } : {}) } }) },
    })
  } catch (error) {
    logger.warn(`Funnelmetry order enqueue failed open: ${error instanceof Error ? error.message : "unknown error"}`)
  }
}

export default async function funnelmetryOrderPlaced({ event, container }: SubscriberArgs<OrderPlacedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as Logger
  void enqueueOrderPlaced(event.data.id, container, logger)
}

export const config: SubscriberConfig = { event: "order.placed" }
