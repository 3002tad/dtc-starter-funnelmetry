"use client"

import { useEffect, useState } from "react"

const consentStorageKey = "funnelmetry.browser.consent.v1.medusa-reference"

declare global {
  interface Window {
    __FUNNELMETRY_CONSENT__?: boolean
  }
}

function hasStoredConsent() {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(consentStorageKey) === "granted"
  } catch {
    return false
  }
}

function restoreTrackingConsent() {
  if (typeof window === "undefined") return
  window.__FUNNELMETRY_CONSENT__ = hasStoredConsent()
}

restoreTrackingConsent()

export function FunnelmetryConsentNotice() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    restoreTrackingConsent()
    setOpen(!hasStoredConsent())
  }, [])

  if (!open) return null

  return (
    <aside
      aria-describedby="funnelmetry-tracking-description"
      aria-labelledby="funnelmetry-tracking-title"
      role="dialog"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "0.5rem",
        bottom: "1.5rem",
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        left: "50%",
        maxWidth: "28rem",
        padding: "1.25rem 3rem 1.25rem 1.25rem",
        position: "fixed",
        transform: "translateX(-50%)",
        width: "calc(100% - 2rem)",
        zIndex: 100,
      }}
    >
      <button
        aria-label="Agree to tracking and close this notice"
        className="text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
        onClick={() => {
          let persisted = false
          try {
            window.localStorage.setItem(consentStorageKey, "granted")
            persisted = true
          } catch {
            // The global flag still enables tracking for the current page lifetime.
          }
          window.__FUNNELMETRY_CONSENT__ = true
          setOpen(false)
          if (persisted) window.location.reload()
        }}
        style={{
          alignItems: "center",
          borderRadius: "9999px",
          display: "flex",
          fontSize: "1.25rem",
          height: "2rem",
          justifyContent: "center",
          lineHeight: 1,
          position: "absolute",
          right: "0.75rem",
          top: "0.75rem",
          width: "2rem",
        }}
        type="button"
      >
        <span aria-hidden="true">&times;</span>
      </button>
      <h2 className="text-base-semi text-gray-900" id="funnelmetry-tracking-title">
        Tracking notice
      </h2>
      <p className="mt-2 text-small-regular text-gray-600" id="funnelmetry-tracking-description">
        Funnelmetry uses anonymous interaction data to understand the shopping journey. Closing this notice enables tracking for this browser.
      </p>
    </aside>
  )
}
