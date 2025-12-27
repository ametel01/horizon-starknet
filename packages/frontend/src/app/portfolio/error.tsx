'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { logError } from '@shared/server/logger';
import { Button } from '@shared/ui/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@shared/ui/Card';

interface PortfolioErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PortfolioError({ error, reset }: PortfolioErrorProps): React.ReactNode {
  useEffect(() => {
    logError(error, { module: 'app', page: 'portfolio' });
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-foreground text-3xl font-bold">Portfolio</h1>
      </div>

      <div className="flex items-center justify-center">
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
              Unable to Load Portfolio
            </CardTitle>
            <CardDescription>
              There was a problem loading your portfolio data. Your positions are safe - this is
              just a display issue.
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
          <CardFooter className="gap-3">
            <Button size="lg" onClick={reset}>
              Retry
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/trade" />}
            >
              Go to Trade
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
