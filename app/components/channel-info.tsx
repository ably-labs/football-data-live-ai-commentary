'use client';

import { MAIN_CHANNEL, COMMENTARY_CHANNEL, CHANNEL_NAMESPACE } from '@/lib/constants';

export function ChannelInfo() {
  return (
    <div className="fixed top-4 right-4 bg-gray-900 text-white p-3 rounded-lg text-xs font-mono opacity-75">
      <div>Namespace: {CHANNEL_NAMESPACE}</div>
      <div>Main: {MAIN_CHANNEL}</div>
      <div>Commentary: {COMMENTARY_CHANNEL}</div>
    </div>
  );
}