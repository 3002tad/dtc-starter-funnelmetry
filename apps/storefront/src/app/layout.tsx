import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"
import { FunnelmetryBootstrap } from "@funnelmetry/client"
import { FunnelmetryConsentNotice } from "@funnelmetry/consent-notice"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body>
        <FunnelmetryConsentNotice />
        <FunnelmetryBootstrap />
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
