import "server-only"

import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { createManagedDeliveryDispatcher } from "@3002tad/funnelmetry-backend-integration-kit"

const sourceId = "medusa-reference"
const sourceKeyId = "medusa-reference-source"
const reliability = {
  "timeoutMs": 800,
  "maxQueueSize": 200,
  "maxAttempts": 3,
  "failureThreshold": 3,
  "cooldownMs": 30000
}
const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,99}$/
const normalizedQueryMaxLength = 160
const anonymousIdentityCookie = "funnelmetry_anonymous_id_medusa-reference"
const sessionIdentityCookie = "funnelmetry_session_id_medusa-reference"

type CartItemAdded = {
  cartId: string
  lineItemId: string
  variantId: string
  quantity: number
  productId?: string
}

let dispatcher: ReturnType<typeof createManagedDeliveryDispatcher> | null | undefined
let lastInactiveWarningAt = 0

function warnSafe(message: string) {
  console.warn(JSON.stringify({ message }))
}

function getDispatcher() {
  if (dispatcher !== undefined) return dispatcher
  const signingKey = process.env.FUNNELMETRY_BACKEND_SIGNING_KEY ?? ""
  const endpoint = process.env.FUNNELMETRY_INGEST_URL ?? ""
  if (!signingKey || !endpoint) {
    if (Date.now() - lastInactiveWarningAt >= 60_000) {
      lastInactiveWarningAt = Date.now()
      warnSafe("Funnelmetry server tracking is inactive: delivery configuration is missing")
    }
    dispatcher = null
    return dispatcher
  }

  try {
    dispatcher = createManagedDeliveryDispatcher({
      sourceId,
      sourceKeyId,
      endpoint,
      signingKey,
      timeoutMs: reliability.timeoutMs,
      maxAttempts: reliability.maxAttempts,
      maxQueueSize: reliability.maxQueueSize,
      failureThreshold: reliability.failureThreshold,
      cooldownMs: reliability.cooldownMs,
      logger: { warn: (entry) => console.warn(JSON.stringify(entry)) },
    })
  } catch {
    dispatcher = null
    warnSafe("Funnelmetry server tracking is inactive: delivery dispatcher could not initialize")
  }
  return dispatcher
}

function identityValue(value: string | undefined) {
  if (!value) return undefined
  try {
    const decoded = decodeURIComponent(value)
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,255}$/.test(decoded) ? decoded : undefined
  } catch {
    return undefined
  }
}

async function readBrowserIdentity() {
  const cookieStore = await cookies()
  return {
    anonymousId: identityValue(cookieStore.get(anonymousIdentityCookie)?.value),
    sessionId: identityValue(cookieStore.get(sessionIdentityCookie)?.value),
  }
}

function normalizeSearchQuery(query: string) {
  const normalized = query.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
  if (!normalized || normalized.length > normalizedQueryMaxLength) return null
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(normalized)) return null
  if (/(?:\+?\d[\s().-]*){8,}/.test(normalized)) return null
  if (/\b(?:password|passcode|otp|cvv|cvc|card(?:\s*number)?|token|secret)\b/i.test(normalized)) return null
  return normalized
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

export async function enqueueSearchOutcome(input: {
  searchInteractionId: string
  query: string
  outcome: "succeeded" | "failed"
  resultCount?: number
}) {
  try {
    if (!opaqueIdPattern.test(input.searchInteractionId)) return
    const identity = await readBrowserIdentity()
    const queryNormalized = normalizeSearchQuery(input.query)
    if (!queryNormalized) return
    const resultCount = input.resultCount
    if (input.outcome === "succeeded") {
      if (!isNonNegativeSafeInteger(resultCount)) return
      getDispatcher()?.enqueue({
        eventId: `medusa:search:${input.searchInteractionId}`,
        sourceEventType: "behavior.search_submitted",
        sourceSchemaVersion: "2.0",
        occurredAt: new Date().toISOString(),
        aggregate: { type: "search_interaction", id: input.searchInteractionId },
        anonymousId: identity.anonymousId,
        sessionId: identity.sessionId,
        correlationId: `search:${input.searchInteractionId}`,
        sourcePayload: { search_interaction_id: input.searchInteractionId, query_normalized: queryNormalized, outcome: input.outcome, result_count: resultCount },
      })
      return
    }

    if (resultCount !== undefined) return
    getDispatcher()?.enqueue({
      eventId: `medusa:search:${input.searchInteractionId}`,
      sourceEventType: "behavior.search_submitted",
      sourceSchemaVersion: "2.0",
      occurredAt: new Date().toISOString(),
      aggregate: { type: "search_interaction", id: input.searchInteractionId },
      anonymousId: identity.anonymousId,
      sessionId: identity.sessionId,
      correlationId: `search:${input.searchInteractionId}`,
      sourcePayload: { search_interaction_id: input.searchInteractionId, query_normalized: queryNormalized, outcome: input.outcome },
    })
  } catch {
    warnSafe("Funnelmetry search tracking dropped without affecting the Search API")
  }
}

export async function enqueueCartItemAdded(input: CartItemAdded) {
  try {
    if (!input.cartId || !input.lineItemId || !input.variantId || !Number.isSafeInteger(input.quantity) || input.quantity < 1) return
    const identity = await readBrowserIdentity()
    getDispatcher()?.enqueue({
      eventId: `medusa:cart.item_added:${input.cartId}:${input.lineItemId}:${randomUUID()}`,
      sourceEventType: "cart.item_added",
      sourceSchemaVersion: "2.0",
      occurredAt: new Date().toISOString(),
      aggregate: { type: "cart", id: input.cartId },
      anonymousId: identity.anonymousId,
      sessionId: identity.sessionId,
      correlationId: `cart:${input.cartId}`,
      sourcePayload: { cart_id: input.cartId, line_item_id: input.lineItemId, variant_id: input.variantId, quantity: input.quantity, ...(input.productId ? { product_id: input.productId } : {}) },
    })
  } catch {
    warnSafe("Funnelmetry cart tracking dropped without affecting the cart operation")
  }
}
