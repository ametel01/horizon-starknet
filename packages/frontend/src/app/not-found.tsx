'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';

export default function NotFound(): React.ReactNode {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6 p-4 text-center">
      <div>
        <h1 className="text-foreground text-8xl font-bold tracking-tight">404</h1>
        <h2 className="text-foreground mt-4 text-2xl font-semibold">Page Not Found</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/" />}>
          Go Home
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/trade" />}>
          Start Trading
        </Button>
      </div>
    </div>
  );
}
