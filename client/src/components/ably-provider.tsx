import { AblyProvider } from "ably/react";
import Ably from "ably";
import { useState, useEffect, type ReactNode } from "react";

interface AblyClientProviderProps {
  children: ReactNode;
}

export function AblyClientProvider({ children }: AblyClientProviderProps) {
  const [client, setClient] = useState<Ably.Realtime | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('AblyClientProvider: Creating client');
      const clientId = `user-${Math.random().toString(36).substring(2, 9)}`;
      const ablyClient = new Ably.Realtime({
        authUrl: `/api/ably-token?clientId=${clientId}`,
        clientId: clientId,
      });
      
      ablyClient.connection.on('connected', () => {
        console.log('AblyClientProvider: Connected to Ably');
      });
      
      ablyClient.connection.on('failed', (stateChange) => {
        console.error('AblyClientProvider: Connection failed', stateChange);
        setError(stateChange.reason?.message || 'Connection failed');
      });
      
      setClient(ablyClient);
      setIsLoading(false);
      
      return () => {
        ablyClient.close();
      };
    } catch (err) {
      console.error('AblyClientProvider: Error creating client', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return null;
  }

  if (error) {
    return (
      <div className="bg-red-900 text-white p-4 m-4 rounded">
        <h2 className="text-xl font-bold">Ably Connection Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <AblyProvider client={client}>
      {children}
    </AblyProvider>
  );
}