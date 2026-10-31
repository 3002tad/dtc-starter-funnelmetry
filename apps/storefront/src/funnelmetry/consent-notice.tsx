"use client"

import { useEffect, useState } from "react"

const consentStorageKey = "funnelmetry.browser.consent.v1.medusa-reference"
declare global { interface Window { __FUNNELMETRY_CONSENT__?: boolean } }
function stored() { if (typeof window === "undefined") return false; try { return localStorage.getItem(consentStorageKey) === "granted" } catch { return false } }
function restore() { if (typeof window !== "undefined") window.__FUNNELMETRY_CONSENT__ = stored() }
restore()
export function FunnelmetryConsentNotice() {
  const [open, setOpen] = useState(false)
  useEffect(() => { restore(); setOpen(!stored()) }, [])
  if (!open) return null
  return <aside aria-describedby="funnelmetry-tracking-description" aria-labelledby="funnelmetry-tracking-title" role="dialog" style={{background:"#fff",bottom:"1.5rem",left:"50%",padding:"1.25rem",position:"fixed",transform:"translateX(-50%)",zIndex:100}}>
    <button aria-label="Agree to tracking and close this notice" onClick={() => { try { localStorage.setItem(consentStorageKey,"granted") } catch {} window.__FUNNELMETRY_CONSENT__=true; setOpen(false); location.reload() }} type="button">&times;</button>
    <h2 id="funnelmetry-tracking-title">Tracking notice</h2><p id="funnelmetry-tracking-description">Funnelmetry uses anonymous interaction data to understand the shopping journey. Closing this notice enables tracking for this browser.</p>
  </aside>
}
