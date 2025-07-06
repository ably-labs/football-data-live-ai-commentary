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
          const response = await fetch('/api/ably-events');
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const data = await response.json();
          console.log('Server subscription status:', data);
          return; // Success
        } catch (err) {
          console.error(`Failed to initialize server (attempt ${i + 1}/${retries}):`, err);
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