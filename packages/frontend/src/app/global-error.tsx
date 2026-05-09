'use client';

import { logError } from '@shared/server/logger';
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
    logError(error, { module: 'app', page: 'global-error', digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <style>{`
          .global-error-shell {
            align-items: center;
            background: #0a0a0a;
            color: #fafafa;
            display: flex;
            flex-direction: column;
            font-family: system-ui, sans-serif;
            justify-content: center;
            min-height: 100vh;
            padding: 2rem;
          }

          .global-error-title {
            font-size: 2rem;
            margin-bottom: 1rem;
          }

          .global-error-message {
            color: #a1a1aa;
            margin-bottom: 2rem;
            max-width: 400px;
            text-align: center;
          }

          .global-error-digest {
            color: #71717a;
            font-family: monospace;
            font-size: 0.75rem;
            margin-bottom: 1.5rem;
          }

          .global-error-action {
            background: #3b82f6;
            border: 0;
            border-radius: 0.5rem;
            color: white;
            cursor: pointer;
            font-size: 1rem;
            padding: 0.75rem 1.5rem;
          }
        `}</style>
        <div className="global-error-shell">
          <h1 className="global-error-title">Something went wrong</h1>
          <p className="global-error-message">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && <p className="global-error-digest">Error ID: {error.digest}</p>}
          <button type="button" onClick={reset} className="global-error-action">
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
