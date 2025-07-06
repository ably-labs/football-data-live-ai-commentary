'use client';

import { useEffect } from 'react';

export function ServerInitializer() {
  useEffect(() => {
    // Initialize server subscription
    fetch('/api/ably-events')
      .then(res => res.json())
      .then(data => console.log('Server subscription status:', data))
      .catch(err => console.error('Failed to initialize server:', err));
  }, []);

  return null;
}