import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  typescript: {
    // We run TypeScript separately in CI
    ignoreBuildErrors: false,
  },
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    resolveAlias: {
      '@contracts': path.resolve(__dirname, '../../contracts/target/dev'),
      '@deploy': path.resolve(__dirname, '../../deploy'),
    },
  },
  // Webpack fallback for production builds
  webpack: (config) => {
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

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withMDX(nextConfig);
