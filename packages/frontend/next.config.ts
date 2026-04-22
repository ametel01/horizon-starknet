import { withSentryConfig } from '@sentry/nextjs';
import withBundleAnalyzer from '@next/bundle-analyzer';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import path from 'path';

// Bundle analyzer - enabled with ANALYZE=true
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env['ANALYZE'] === 'true',
});

// Security headers are now set dynamically in proxy.ts with CSP nonce support
// See src/proxy.ts and src/lib/csp.ts for the implementation

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  // Enable source maps in production for debugging and Lighthouse insights
  productionBrowserSourceMaps: true,

  // Note: Security headers are set in proxy.ts with dynamic CSP nonce

  // Image optimization configuration
  images: {
    // Serve modern image formats for better compression
    // AVIF offers ~50% better compression than WebP
    formats: ['image/avif', 'image/webp'],
    // Device sizes for responsive images (default is fine for most cases)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for the sizes prop (smaller increments for UI elements)
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Disable image optimization in development for faster builds
    unoptimized: process.env.NODE_ENV === 'development',
  },
  experimental: {
    // Inline CSS to eliminate render-blocking stylesheet requests
    // This inlines CSS into <style> tags in the <head> instead of external <link> tags
    inlineCss: true,
    // Optimize barrel file imports for libraries with many re-exports
    // This transforms barrel imports to direct imports at build time
    // See: https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons'],
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

// Sentry configuration options - only include org/project if defined
const sentryOrg = process.env['SENTRY_ORG'];
const sentryProject = process.env['SENTRY_PROJECT'];

const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Only include org/project if they're defined
  ...(sentryOrg && { org: sentryOrg }),
  ...(sentryProject && { project: sentryProject }),

  // Only upload source maps in production with a valid auth token
  silent: !process.env['CI'],

  // Upload source maps for error tracking
  widenClientFileUpload: true,

  // Hide source maps from browsers
  hideSourceMaps: true,

  // Route browser requests to Sentry through a Next.js rewrite to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Webpack-specific options (new format)
  webpack: {
    // Tree-shake Sentry logger statements to reduce bundle size
    treeshake: {
      removeDebugLogging: true,
    },
    // Annotate React components for better stack traces
    reactComponentAnnotation: {
      enabled: true,
    },
  },
};

// Chain: bundleAnalyzer -> MDX -> Sentry
export default withSentryConfig(bundleAnalyzer(withMDX(nextConfig)), sentryWebpackPluginOptions);
