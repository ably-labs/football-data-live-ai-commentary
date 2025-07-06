"use client"

import { AblyProvider } from "ably/react"
import Ably from "ably"
import { useRef, type ReactNode } from "react"

export function AblyClientProvider({ children }: { children: ReactNode }) {
  // Use a ref to create and store the client instance.
  // This ensures that the client is created only once per component instance (i.e., per tab),
  // and it persists across re-renders, guaranteeing a unique clientId per session.
  const clientRef = useRef<Ably.Realtime | null>(null)

  const getClient = () => {
    if (!clientRef.current) {
      const clientId = `user-${Math.random().toString(36).substring(2, 9)}`;
      const authUrl = typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.host}/api/ably-token?clientId=${clientId}`
        : `/api/ably-token?clientId=${clientId}`;
      
      clientRef.current = new Ably.Realtime({
        authUrl: authUrl,
        clientId: clientId,
      })
    }
    return clientRef.current
  }

  return <AblyProvider client={getClient()}>{children}</AblyProvider>
}
