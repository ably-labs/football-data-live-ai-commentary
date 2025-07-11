import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { AblyClientProvider } from "./ably-provider"

export const metadata: Metadata = {
  title: "Football Frenzy - AI Commentary Demo",
  description: "Realtime AI-powered football commentary using Ably and OpenAI",
  icons: {
    icon: '/football-icon.svg',
    shortcut: '/football-icon.svg',
    apple: '/football-icon.svg',
  },
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
