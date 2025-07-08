'use client'

import { useAbly } from "ably/react"

export function TestAbly() {
  const client = useAbly()
  
  return (
    <div className="p-4">
      <h2>Ably Test</h2>
      <p>Client ID: {client?.auth.clientId || 'Not connected'}</p>
      <p>Connection State: {client?.connection.state || 'Unknown'}</p>
    </div>
  )
}