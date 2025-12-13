import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // We run ESLint separately in CI
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We run TypeScript separately in CI
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
