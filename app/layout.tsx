import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AblyClientProvider } from "./ably-provider"

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        <AblyClientProvider>{children}</AblyClientProvider>
      </body>
    </html>
  )
}
