import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createManagedDeliveryDispatcher } from "../funnelmetry/managed-delivery-dispatcher"

type OrderPlacedData = { id: string }
type OrderItem = { product_id?: string; variant_id?: string; quantity?: number; unit_price?: number }
type Order = { id: string; created_at?: string; currency_code?: string; total?: number; items?: OrderItem[] }
type Logger = { warn: (message: string) => void }
type MedusaContainer = SubscriberArgs<OrderPlacedData>["container"]

const sourceId = "medusa-reference"
const sourceKeyId = "medusa-reference-dev"
const reliability = {"failureMode":"fail_open","timeoutMs":800,"maxQueueSize":200,"retry":{"maxAttempts":3},"circuitBreaker":{"failureThreshold":3,"cooldownMs":30000}}
let dispatcher: ReturnType<typeof createManagedDeliveryDispatcher> | undefined
let lastInactiveWarningAt = 0

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
    endpoint: "http://host.docker.internal:31000/v1/ingress/events",
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
    const orderModuleService = container.resolve(Modules.ORDER) as { retrieveOrder: (id: string, options: Record<string, unknown>) => Promise<Order> }
    const order = await orderModuleService.retrieveOrder(orderId, { relations: ["items"] })
    if (!order.created_at || !order.currency_code) {
      logger.warn("Funnelmetry order forward skipped: missing authoritative order time/currency")
      return
    }
    getDispatcher(logger)?.enqueue({
      eventId: `medusa:order.placed:${orderId}`,
      sourceEventType: "medusa.order_placed",
      occurredAt: order.created_at,
      aggregate: { type: "order", id: order.id },
      sourcePayload: { order_id: order.id, currency_code: order.currency_code, total_minor: order.total, items: (order.items ?? []).map((item) => ({ product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity, unit_price_minor: item.unit_price })) },
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
