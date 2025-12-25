// Server-side instrumentation for Next.js
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;

  // Only initialize Sentry if DSN is configured
  if (!dsn) {
    return;
  }

  // Detect runtime (Node.js server vs Edge)
  const isEdge = process.env.NEXT_RUNTIME === 'edge';

  Sentry.init({
    dsn,

    // Only enable in production
    enabled: process.env.NODE_ENV === 'production',

    // Enable structured logging
    enableLogs: true,

    // Sample rate for performance monitoring
    tracesSampleRate: 0.1,

    // Disable debug logging
    debug: false,

    // Runtime-specific integrations
    integrations: isEdge
      ? []
      : [
          // Capture console.error and console.warn as logs (server only)
          Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
        ],

    // Filter out noisy errors
    ignoreErrors: [
      // Network timeouts
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
    ],

    // Set custom tags for better filtering
    initialScope: {
      tags: {
        app: 'horizon-frontend',
        runtime: isEdge ? 'edge' : 'server',
      },
    },

    // Before sending, sanitize sensitive data
    beforeSend(event) {
      // Remove any potentially sensitive server-side data
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
