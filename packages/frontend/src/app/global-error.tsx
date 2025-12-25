'use client';

import { useEffect } from 'react';

/**
 * Global error boundary for the entire application.
 * This catches React rendering errors that occur outside of route error boundaries.
 * https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactNode {
  useEffect(() => {
    // Log error to console (server-side Sentry will capture via instrumentation)
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#0a0a0a',
            color: '#fafafa',
          }}
        >
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong</h1>
          <p
            style={{
              color: '#a1a1aa',
              marginBottom: '2rem',
              textAlign: 'center',
              maxWidth: '400px',
            }}
          >
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#71717a',
                marginBottom: '1.5rem',
                fontFamily: 'monospace',
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
