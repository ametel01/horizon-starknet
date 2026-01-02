import { DocsLayout } from '@features/docs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation | Horizon Protocol',
  description: 'Learn how to use Horizon Protocol for yield tokenization on Starknet',
};

// ISR: Revalidate documentation pages every hour
// This allows updates to propagate while keeping pages fast
export const revalidate = 3600;

export default function DocsRootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return <DocsLayout>{children}</DocsLayout>;
}
