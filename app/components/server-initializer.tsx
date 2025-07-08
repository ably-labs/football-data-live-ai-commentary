'use client';

import { useEffect, useRef } from 'react';

export function ServerInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Initialize server subscription with retry
    const initializeWithRetry = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          console.log(`[ServerInitializer] Initializing server subscription (attempt ${i + 1}/${retries})...`);
          const response = await fetch('/api/ably-events');
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const data = await response.json();
          console.log('[ServerInitializer] Server subscription status:', data);
          
          // IMPORTANT: In serverless, we need to keep calling the endpoint
          // to maintain the "subscription" since functions terminate after response
          console.warn('[ServerInitializer] NOTE: Running in serverless environment.');
          console.warn('[ServerInitializer] The server subscription will NOT persist between function calls.');
          console.warn('[ServerInitializer] Consider using Ably webhooks or an external worker service.');
          
          return; // Success
        } catch (err) {
          console.error(`[ServerInitializer] Failed to initialize server (attempt ${i + 1}/${retries}):`, err);
          if (i < retries - 1) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      }
    };

    initializeWithRetry();
  }, []);

  return null;
}