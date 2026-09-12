"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { createBrowserSdk } from "@3002tad/funnelmetry-browser-sdk"

const sourceId = "medusa-reference"
const sourceKeyId = "medusa-reference-relay"
const allowedEventTypes = ["behavior.page_viewed","behavior.scroll_depth_reached","promotion.banner_impression","promotion.banner_clicked","behavior.search_submitted","behavior.filter_applied","behavior.product_viewed","cart.add_clicked","checkout.started"]
const reliability = {"failureMode":"fail_open","timeoutMs":800,"maxQueueSize":200,"retry":{"maxAttempts":3},"circuitBreaker":{"failureThreshold":3,"cooldownMs":30000}}

type EventPayload = Record<string, unknown>
type BrowserSdk = ReturnType<typeof createBrowserSdk>
type PageContext = { page_type: string; path_template: string; page_instance_id: string }

declare global { interface Window { __FUNNELMETRY_CONSENT__?: boolean } }

let sdk: BrowserSdk | null | undefined
let activePage: { pathname: string; context: PageContext } | undefined

function enabled(eventType: string) {
  return allowedEventTypes.includes(eventType)
}

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

function pageDescriptor(pathname: string | null) {
  const safePathname = pathname || "/"
  const segments = safePathname.split("/").filter(Boolean)
  const route = segments.length > 0 ? segments.slice(1) : []
  if (route.length === 0) return { page_type: "home", path_template: "/{countryCode}" }
  if (route[0] === "store") return { page_type: "catalog", path_template: "/{countryCode}/store" }
  if (route[0] === "products") return { page_type: "product", path_template: "/{countryCode}/products/{handle}" }
  if (route[0] === "checkout") return { page_type: "checkout", path_template: "/{countryCode}/checkout" }
  if (route[0] === "categories") return { page_type: "category", path_template: "/{countryCode}/categories/{category}" }
  if (route[0] === "collections") return { page_type: "collection", path_template: "/{countryCode}/collections/{handle}" }
  if (route[0] === "cart") return { page_type: "cart", path_template: "/{countryCode}/cart" }
  if (route[0] === "account") return { page_type: "account", path_template: "/{countryCode}/account" }
  return { page_type: "other", path_template: "/{countryCode}/other" }
}

function pageContext(pathname: string | null): PageContext | null {
  const key = pathname || "/"
  if (activePage?.pathname === key) return activePage.context
  const currentSdk = getSdk()
  if (!currentSdk) return null
  activePage = { pathname: key, context: currentSdk.createPageContext(pageDescriptor(pathname)) }
  return activePage.context
}

function activePageContext() {
  return pageContext(typeof window === "undefined" ? null : window.location.pathname)
}

function track(eventType: string, payload: EventPayload) {
  if (!enabled(eventType)) return Promise.resolve({ status: "disabled_by_manifest" })
  const currentSdk = getSdk()
  return currentSdk ? currentSdk.trackBehavior(eventType, payload) : Promise.resolve({ status: "inactive" })
}

function queryLengthBucket(length: number) {
  if (length === 0) return "empty"
  if (length <= 2) return "1-2"
  if (length <= 5) return "3-5"
  if (length <= 10) return "6-10"
  if (length <= 20) return "11-20"
  return "21+"
}

export function FunnelmetryBootstrap() {
  const pathname = usePathname()

  useEffect(() => getSdk()?.attachLifecycle(), [])

  useEffect(() => {
    const currentSdk = getSdk()
    const page = pageContext(pathname)
    if (!currentSdk || !page) return
    if (enabled("behavior.page_viewed")) void currentSdk.trackPageView(page)
    if (!enabled("behavior.scroll_depth_reached")) return
    return currentSdk.attachScrollDepthObserver({ page })
  }, [pathname])

  return null
}

export function FunnelmetryProductViewed({ productId, variantId }: { productId: string; variantId?: string }) {
  const pathname = usePathname()
  useEffect(() => {
    const page = pageContext(pathname)
    if (!page) return
    void track("behavior.product_viewed", { product_id: productId, ...(variantId ? { variant_id: variantId } : {}), page_instance_id: page.page_instance_id })
  }, [pathname, productId, variantId])
  return null
}

export function FunnelmetryCheckoutStarted({ cartId, step }: { cartId: string; step: string }) {
  const pathname = usePathname()
  useEffect(() => {
    const page = pageContext(pathname)
    void track("checkout.started", { cart_id: cartId, step, ...(page ? { page_instance_id: page.page_instance_id } : {}) })
  }, [cartId, pathname, step])
  return null
}

export function trackCartAddClicked(input: { productId: string; variantId: string; quantity: number; cartId?: string }) {
  const page = activePageContext()
  return track("cart.add_clicked", { product_id: input.productId, variant_id: input.variantId, quantity: input.quantity, ...(input.cartId ? { cart_id: input.cartId } : {}), ...(page ? { page_instance_id: page.page_instance_id } : {}) })
}

export function trackSearchSubmitted(queryLength: number) {
  const page = activePageContext()
  if (!page) return Promise.resolve({ status: "inactive" })
  return track("behavior.search_submitted", { page_instance_id: page.page_instance_id, query_length_bucket: queryLengthBucket(queryLength) })
}

export function trackFilterApplied(input: { filterKeys: string[]; activeFilterCount: number }) {
  const page = activePageContext()
  if (!page) return Promise.resolve({ status: "inactive" })
  return track("behavior.filter_applied", { page_instance_id: page.page_instance_id, filter_keys: input.filterKeys, active_filter_count: input.activeFilterCount })
}

export function FunnelmetryPromotionBanner({ bannerId, placementId, campaignId, children }: { bannerId: string; placementId: string; campaignId?: string; children: ReactNode }) {
  const pathname = usePathname()
  const element = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const currentSdk = getSdk()
    const page = pageContext(pathname)
    if (!currentSdk || !page || !element.current || !enabled("promotion.banner_impression")) return
    return currentSdk.attachBannerImpressionObserver({ element: element.current, bannerId, placementId, pageInstanceId: page.page_instance_id, ...(campaignId ? { campaignId } : {}) })
  }, [bannerId, campaignId, pathname, placementId])

  return <div ref={element} onClick={() => {
    const page = pageContext(pathname)
    if (page) void track("promotion.banner_clicked", { banner_id: bannerId, placement_id: placementId, page_instance_id: page.page_instance_id, ...(campaignId ? { campaign_id: campaignId } : {}) })
  }}>{children}</div>
}
