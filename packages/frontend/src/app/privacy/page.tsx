import type { Metadata } from 'next';
import Link from 'next/link';

import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Privacy Policy | Horizon Protocol',
  description: 'Privacy Policy for Horizon Protocol',
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <section className="py-8">
      <h2 className="text-foreground mb-4 text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground space-y-4">{children}</div>
    </section>
  );
}

function InfoBox({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
      <div className="text-foreground text-sm">{children}</div>
    </div>
  );
}

function DataCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}): React.ReactNode {
  return (
    <div className="border-border rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <h4 className="text-foreground font-medium">{title}</h4>
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPage(): React.ReactNode {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {/* Back link */}
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-foreground text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground mt-2">Last updated: December 2024</p>
      </div>

      <InfoBox>
        <strong>TL;DR:</strong> Horizon Protocol is decentralized. We don&apos;t collect personal
        information, don&apos;t have access to your funds, and don&apos;t track your activity. Your
        blockchain transactions are public by nature.
      </InfoBox>

      <Separator className="my-8" />

      {/* Sections */}
      <Section title="1. Introduction">
        <p>
          Horizon Protocol is committed to protecting your privacy. This policy explains how we
          handle information when you use our decentralized application.
        </p>
      </Section>

      <Separator />

      <Section title="2. Decentralized Nature">
        <p>As a decentralized protocol:</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DataCard
            icon="🔓"
            title="No Account Required"
            description="No registration or sign-up needed"
          />
          <DataCard
            icon="🔐"
            title="Non-Custodial"
            description="We never access your private keys"
          />
          <DataCard
            icon="👤"
            title="No Personal Data"
            description="We don't collect identifying info"
          />
          <DataCard
            icon="⛓️"
            title="Direct Transactions"
            description="You interact directly with the blockchain"
          />
        </div>
      </Section>

      <Separator />

      <Section title="3. What We Don't Collect">
        <div className="border-border bg-muted/30 rounded-lg border p-6">
          <p className="text-foreground mb-4 font-medium">We do not collect:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="text-destructive">✕</span>
              <span>Names or email addresses</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-destructive">✕</span>
              <span>Government IDs</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-destructive">✕</span>
              <span>Bank or credit card info</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-destructive">✕</span>
              <span>Private keys or seed phrases</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-destructive">✕</span>
              <span>Personal financial data</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-destructive">✕</span>
              <span>Location data</span>
            </div>
          </div>
        </div>
      </Section>

      <Separator />

      <Section title="4. Blockchain Data">
        <p>When you interact with the Protocol, transactions are recorded on Starknet:</p>
        <div className="mt-4 grid gap-3">
          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Public</h4>
            <p className="text-muted-foreground mt-1 text-sm">
              All blockchain transactions are publicly visible to anyone
            </p>
          </div>
          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Immutable</h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Once recorded, transactions cannot be deleted or modified
            </p>
          </div>
          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Pseudonymous</h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Transactions are linked to wallet addresses, not personal identities
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm">
          We do not control blockchain data and cannot modify or delete your transaction history.
        </p>
      </Section>

      <Separator />

      <Section title="5. Technical Data">
        <p>Our web interface may collect limited, anonymized technical data:</p>
        <ul className="mt-4 ml-6 list-disc space-y-2">
          <li>
            <strong>Device info:</strong> Browser type, OS, screen size
          </li>
          <li>
            <strong>Usage data:</strong> Pages visited, features used
          </li>
          <li>
            <strong>Network info:</strong> Anonymized IP address
          </li>
        </ul>
        <InfoBox>
          This data is used solely to improve the interface and is not linked to your wallet or
          blockchain activity.
        </InfoBox>
      </Section>

      <Separator />

      <Section title="6. Cookies & Local Storage">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Essential Cookies</h4>
            <p className="text-muted-foreground mt-1 text-sm">
              Required for basic functionality (theme, UI settings)
            </p>
          </div>
          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Local Storage</h4>
            <p className="text-muted-foreground mt-1 text-sm">Remembers your preferences locally</p>
          </div>
        </div>
        <p className="mt-4 text-sm">
          We do not use tracking cookies or share data with advertising networks.
        </p>
      </Section>

      <Separator />

      <Section title="7. Third-Party Services">
        <p>The interface may interact with:</p>
        <ul className="mt-4 ml-6 list-disc space-y-2">
          <li>
            <strong>Wallet providers</strong> (Argent, Braavos) — governed by their own policies
          </li>
          <li>
            <strong>RPC providers</strong> — to communicate with Starknet
          </li>
          <li>
            <strong>Price oracles</strong> — for market data
          </li>
        </ul>
      </Section>

      <Separator />

      <Section title="8. Data Security">
        <p>We implement reasonable security measures. However:</p>
        <ul className="mt-4 ml-6 list-disc space-y-2">
          <li>No system is completely secure</li>
          <li>You are responsible for securing your wallet and private keys</li>
          <li>We cannot guarantee security of data transmitted over the internet</li>
        </ul>
      </Section>

      <Separator />

      <Section title="9. Your Rights">
        <p>Depending on your jurisdiction, you may:</p>
        <ul className="mt-4 ml-6 list-disc space-y-2">
          <li>Access technical data we may have collected</li>
          <li>Request deletion of technical data (blockchain data cannot be deleted)</li>
          <li>Opt out of non-essential data collection</li>
        </ul>
      </Section>

      <Separator />

      <Section title="10. Children's Privacy">
        <p>
          The Protocol is not intended for individuals under 18. We do not knowingly collect
          information from children.
        </p>
      </Section>

      <Separator />

      <Section title="11. Changes to This Policy">
        <p>
          We may update this policy from time to time. Changes will be posted here with an updated
          date. Continued use constitutes acceptance.
        </p>
      </Section>

      <Separator />

      <Section title="12. Contact">
        <p>
          For questions about this Privacy Policy, please refer to our{' '}
          <Link href="/docs/faq" className="text-primary hover:text-primary/80 underline">
            FAQ
          </Link>{' '}
          or{' '}
          <Link href="/docs" className="text-primary hover:text-primary/80 underline">
            documentation
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
