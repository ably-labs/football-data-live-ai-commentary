import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Enable server actions if needed
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
