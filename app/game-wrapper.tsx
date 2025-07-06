'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { LoadingScreen } from './components/loading-screen';

// Dynamically import the game page with no SSR to avoid hydration issues
const FiveASideFrenzyPage = dynamic(
  () => import('./game'),
  { 
    ssr: false,
    loading: () => <LoadingScreen />
  }
);

export default function GameWrapper() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <LoadingScreen />;
  }

  return <FiveASideFrenzyPage />;
}