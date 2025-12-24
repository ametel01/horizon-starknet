import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  // Enable source maps in production for debugging and Lighthouse insights
  productionBrowserSourceMaps: true,
  experimental: {
    // Inline CSS to eliminate render-blocking stylesheet requests
    // This inlines CSS into <style> tags in the <head> instead of external <link> tags
    inlineCss: true,
  },
  typescript: {
    // We run TypeScript separately in CI
    ignoreBuildErrors: false,
  },
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    resolveAlias: {
      '@contracts': path.resolve(__dirname, '../../contracts/target/dev'),
      '@deploy': path.resolve(__dirname, '../../deploy'),
      '@indexer': path.resolve(__dirname, '../indexer/src'),
    },
  },
  // Webpack fallback for production builds
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@contracts': path.resolve(__dirname, '../../contracts/target/dev'),
      '@deploy': path.resolve(__dirname, '../../deploy'),
      '@indexer': path.resolve(__dirname, '../indexer/src'),
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
