import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { createBackendForwarder } from "@funnelmetry/backend-integration-kit"

type OrderPlacedData = { id: string }
type OrderItem = { product_id?: string; variant_id?: string; quantity?: number; unit_price?: number }
type Order = { id: string; created_at?: string; currency_code?: string; total?: number; items?: OrderItem[] }
const sourceId = "medusa-reference"
const sourceKeyId = "medusa-reference-dev"
const reliability = {"failureMode":"fail_open","timeoutMs":800,"maxQueueSize":200,"retry":{"maxAttempts":3}}

export default async function funnelmetryOrderPlaced({ event, container }: SubscriberArgs<OrderPlacedData>) {
  const logger = container.resolve("logger") as { warn: (message: string) => void }
  try {
    const orderModuleService = container.resolve("order") as { retrieveOrder: (id: string, options: Record<string, unknown>) => Promise<Order> }
    const order = await orderModuleService.retrieveOrder(event.data.id, { relations: ["items"] })
    if (!order.created_at || !order.currency_code) throw new Error("Missing authoritative order time/currency")
    const forwarder = createBackendForwarder({
      sourceId,
      sourceKeyId,
      endpoint: "http://host.docker.internal:31000/v1/ingress/events",
      signingKey: process.env.FUNNELMETRY_BACKEND_SIGNING_KEY ?? "",
      timeoutMs: reliability.timeoutMs,
      maxAttempts: reliability.retry.maxAttempts,
      logger: { warn: (entry: unknown) => logger.warn(JSON.stringify(entry)) },
    })
    await forwarder.forward({
      eventId: `medusa:order.placed:${event.data.id}`,
      sourceEventType: "medusa.order_placed",
      occurredAt: order.created_at,
      aggregate: { type: "order", id: order.id },
      sourcePayload: { order_id: order.id, currency_code: order.currency_code, total_minor: order.total, items: (order.items ?? []).map((item) => ({ product_id: item.product_id, variant_id: item.variant_id, quantity: item.quantity, unit_price_minor: item.unit_price })) },
    })
  } catch (error) {
    logger.warn(`Funnelmetry order forward failed open: ${error instanceof Error ? error.message : "unknown error"}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
