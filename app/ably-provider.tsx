"use client"

import { AblyProvider, ChannelProvider } from "ably/react"
import Ably from "ably"
import { useState, useEffect, type ReactNode } from "react"

interface AblyClientProviderProps {
  children: ReactNode
  channelName?: string
}

export function AblyClientProvider({ children, channelName }: AblyClientProviderProps) {
  const [client, setClient] = useState<Ably.Realtime | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Only create client on the client side
    const clientId = `user-${Math.random().toString(36).substring(2, 9)}`;
    const ablyClient = new Ably.Realtime({
      authUrl: `${window.location.protocol}//${window.location.host}/api/ably-token?clientId=${clientId}`,
      clientId: clientId,
    })
    setClient(ablyClient)
    setIsLoading(false)
    
    return () => {
      ablyClient.close()
    }
  }, [])

  // During SSR and initial client render, show nothing to avoid hydration mismatch
  if (isLoading) {
    return null;
  }

  if (!client) {
    return null;
  }

  return (
    <AblyProvider client={client}>
      {channelName ? (
        <ChannelProvider channelName={channelName}>
          {children}
        </ChannelProvider>
      ) : (
        children
      )}
    </AblyProvider>
  )
}
