// Client-side instrumentation
// Note: Sentry is only initialized server-side to keep the DSN private.
// Client errors are captured via the error boundary and logged to console.

// Required export for Next.js App Router (no-op on client)
export const onRouterTransitionStart = () => {};
