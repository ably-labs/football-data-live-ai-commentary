"use client"

import { AblyProvider } from "ably/react"
import Ably from "ably"
import { useRef, useState, useEffect, type ReactNode } from "react"

export function AblyClientProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Ably.Realtime | null>(null)

  useEffect(() => {
    // Only create client on the client side
    if (typeof window !== 'undefined') {
      const clientId = `user-${Math.random().toString(36).substring(2, 9)}`;
      const ablyClient = new Ably.Realtime({
        authUrl: `${window.location.protocol}//${window.location.host}/api/ably-token?clientId=${clientId}`,
        clientId: clientId,
      })
      setClient(ablyClient)
      
      return () => {
        ablyClient.close()
      }
    }
  }, [])

  if (!client) {
    return <>{children}</> // Render children without Ably during SSR
  }

  return <AblyProvider client={client}>{children}</AblyProvider>
}
