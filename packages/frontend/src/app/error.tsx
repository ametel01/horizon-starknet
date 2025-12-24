'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { logError } from '@/lib/logger';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps): React.ReactNode {
  useEffect(() => {
    logError(error, { module: 'app', page: 'global' });
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Something went wrong
          </CardTitle>
          <CardDescription>
            An unexpected error occurred. Our team has been notified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error.digest ? (
            <p className="text-muted-foreground text-xs">
              Error ID: <code className="text-foreground font-mono">{error.digest}</code>
            </p>
          ) : null}
          {process.env.NODE_ENV === 'development' && error.message ? (
            <div className="bg-muted mt-3 rounded-md p-3">
              <code className="text-destructive text-xs break-all">{error.message}</code>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={reset}>Try Again</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Go Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
