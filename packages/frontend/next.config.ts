import { withSentryConfig } from '@sentry/nextjs';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import path from 'path';

// Content Security Policy configuration
// Note: 'unsafe-inline' for styles is required for Tailwind CSS and dynamic styling
// 'unsafe-eval' is NOT included to prevent XSS attacks
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self'
    https://*.starknet.io
    https://*.infura.io
    https://*.alchemy.com
    https://*.blast.io
    https://*.voyager.online
    https://*.avnu.fi
    https://api.pragma.build
    https://*.sentry.io
    wss://*.starknet.io
    wss://*.infura.io
    wss://*.alchemy.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

// Security headers applied to all routes
const securityHeaders = [
  // Enable DNS prefetching for external resources
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Force HTTPS for 2 years, include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Prevent clickjacking - page cannot be embedded in iframes
  { key: 'X-Frame-Options', value: 'DENY' },
  // Prevent MIME type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer information sent with requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable unnecessary browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Content Security Policy
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  // Enable source maps in production for debugging and Lighthouse insights
  productionBrowserSourceMaps: true,

  // Security headers for all routes
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },

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
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;

const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Only include org/project if they're defined
  ...(sentryOrg && { org: sentryOrg }),
  ...(sentryProject && { project: sentryProject }),

  // Only upload source maps in production with a valid auth token
  silent: !process.env.CI,

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

export default withSentryConfig(withMDX(nextConfig), sentryWebpackPluginOptions);
