import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"
import { FunnelmetryBootstrap } from "@funnelmetry/client"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <body>
        <FunnelmetryBootstrap />
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
