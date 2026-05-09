import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Read Horizon Protocol guides, mechanics, risk notes, and integration references.',
};

export default function DocsPage(): never {
  redirect('/docs/what-is-horizon');
}
