import type { NextConfig } from 'next';
import path from 'path';

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
  // Allow importing from contracts directory
  webpack: (config) => {
    // Add alias for contracts ABIs
    config.resolve.alias = {
      ...config.resolve.alias,
      '@contracts': path.resolve(__dirname, '../../contracts/target/dev'),
      '@deploy': path.resolve(__dirname, '../../deploy'),
    };
    return config;
  },
  // Output file tracing for external files
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
};

export default nextConfig;
