import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AblyClientProvider } from "./ably-provider"

export const metadata: Metadata = {
  title: "Football Frenzy - AI Commentary Demo",
  description: "Real-time AI-powered football commentary using Ably and OpenAI",
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
        <AblyClientProvider channelName="football-frenzy">{children}</AblyClientProvider>
      </body>
    </html>
  )
}
