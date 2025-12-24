// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

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

    integrations: [
      // Capture console.error and console.warn as logs
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
        runtime: 'server',
      },
    },

    // Before sending, sanitize sensitive data
    beforeSend(event) {
      // Remove any potentially sensitive server-side data
      if (event.request?.headers) {
        // Remove auth headers
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
