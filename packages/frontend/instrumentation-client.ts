// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Only initialize Sentry if DSN is configured
if (dsn) {
  Sentry.init({
    dsn,

    // Only enable in production
    enabled: process.env.NODE_ENV === 'production',

    // Enable structured logging
    enableLogs: true,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 0.1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Replay configuration for error context
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
      // Capture console.error and console.warn as logs
      Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      // Wallet connection errors (expected user behavior)
      'User rejected the request',
      'User cancelled',
      // Network errors that are transient
      'Failed to fetch',
      'NetworkError',
      // Third-party script errors
      /^Script error\.?$/,
    ],

    // Set custom tags for better filtering
    initialScope: {
      tags: {
        app: 'horizon-frontend',
      },
    },

    // Before sending, sanitize sensitive data
    beforeSend(event) {
      // Remove wallet addresses from breadcrumbs if present
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.message) {
            // Mask Starknet addresses (0x followed by 64 hex chars)
            breadcrumb.message = breadcrumb.message.replace(
              /0x[a-fA-F0-9]{64}/g,
              '0x[REDACTED]'
            );
          }
          return breadcrumb;
        });
      }
      return event;
    },
  });
}

// Required for Next.js App Router navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
