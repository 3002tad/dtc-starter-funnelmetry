"use client"

import { useEffect } from "react"
import { createBrowserSdk } from "@3002tad/funnelmetry-browser-sdk"

const sourceId = "medusa-reference"
const sourceKeyId = "medusa-reference-relay"
const allowedEventTypes = ["behavior.product_viewed","cart.add_clicked","checkout.started"]
const reliability = {"failureMode":"fail_open","timeoutMs":800,"maxQueueSize":200,"retry":{"maxAttempts":3},"circuitBreaker":{"failureThreshold":3,"cooldownMs":30000}}

type EventPayload = Record<string, unknown>
type BrowserSdk = ReturnType<typeof createBrowserSdk>

declare global { interface Window { __FUNNELMETRY_CONSENT__?: boolean } }

let sdk: BrowserSdk | null | undefined

function getSdk(): BrowserSdk | null {
  if (sdk !== undefined) return sdk
  try {
    sdk = createBrowserSdk({
      sourceId,
      sourceKeyId,
      endpoint: "https://ingest-test.entidi.io.vn/v1/ingress/events",
      writeKey: process.env.NEXT_PUBLIC_FUNNELMETRY_BROWSER_WRITE_KEY ?? "",
      allowedEventTypes,
      maxAttempts: reliability.retry.maxAttempts,
      maxQueueSize: reliability.maxQueueSize,
      hasConsent: () => typeof window !== "undefined" && window.__FUNNELMETRY_CONSENT__ === true,
    })
  } catch (error) {
    sdk = null
    console.warn("Funnelmetry browser integration is inactive", error)
  }
  return sdk
}

function track(eventType: string, payload: EventPayload) {
  const currentSdk = getSdk()
  return currentSdk ? currentSdk.track(eventType, payload) : Promise.resolve({ status: "inactive" })
}

export function FunnelmetryBootstrap() {
  useEffect(() => getSdk()?.attachLifecycle(), [])
  return null
}

export function FunnelmetryProductViewed({ productId }: { productId: string }) {
  useEffect(() => { void track("behavior.product_viewed", { product_id: productId }) }, [productId])
  return null
}

export function FunnelmetryCheckoutStarted({ cartId, step }: { cartId: string; step: string }) {
  useEffect(() => { void track("checkout.started", { cart_id: cartId, step }) }, [cartId, step])
  return null
}

export function trackCartAddClicked(input: { productId: string; variantId: string; quantity: number }) {
  return track("cart.add_clicked", { product_id: input.productId, variant_id: input.variantId, quantity: input.quantity })
}
