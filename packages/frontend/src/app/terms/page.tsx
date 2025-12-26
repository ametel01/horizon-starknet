import type { Metadata } from 'next';
import Link from 'next/link';

import { Separator } from '@shared/ui/separator';

export const metadata: Metadata = {
  title: 'Terms of Service | Horizon Protocol',
  description: 'Terms of Service for Horizon Protocol',
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

function WarningBox({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4">
      <div className="text-destructive text-sm">{children}</div>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <div className="border-border bg-muted/50 rounded-lg border p-4">
      <div className="text-foreground text-sm">{children}</div>
    </div>
  );
}

export default function TermsPage(): React.ReactNode {
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
        <h1 className="text-foreground text-3xl font-bold">Terms of Service</h1>
        <p className="text-muted-foreground mt-2">Last updated: December 2024</p>
      </div>

      <WarningBox>
        <strong>Important:</strong> By using Horizon Protocol, you agree to these terms. Please read
        them carefully. The Protocol involves significant risks including potential loss of funds.
      </WarningBox>

      <Separator className="my-8" />

      {/* Sections */}
      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using Horizon Protocol (&quot;the Protocol&quot;), you agree to be bound
          by these Terms of Service. If you do not agree, do not use the Protocol.
        </p>
      </Section>

      <Separator />

      <Section title="2. Description of Service">
        <p>
          Horizon Protocol is a decentralized finance (DeFi) application on Starknet that enables
          users to tokenize yield-bearing assets into Principal Tokens (PT) and Yield Tokens (YT).
        </p>
        <InfoBox>
          The Protocol provides a non-custodial interface. We never have access to your funds or
          private keys.
        </InfoBox>
      </Section>

      <Separator />

      <Section title="3. Eligibility">
        <p>You represent and warrant that:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>You are at least 18 years of age or the legal age in your jurisdiction</li>
          <li>You have the legal capacity to enter into these Terms</li>
          <li>Your use of the Protocol complies with all applicable laws</li>
          <li>You are not subject to economic sanctions or on any restricted persons list</li>
        </ul>
      </Section>

      <Separator />

      <Section title="4. No Financial Advice">
        <WarningBox>
          <strong>
            The Protocol does not provide financial, investment, legal, or tax advice.
          </strong>{' '}
          All information is for informational purposes only. Consult qualified professionals before
          making financial decisions. Past performance is not indicative of future results.
        </WarningBox>
      </Section>

      <Separator />

      <Section title="5. Risks">
        <p>By using the Protocol, you acknowledge these risks that may result in loss of funds:</p>

        <div className="mt-4 grid gap-3">
          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Smart Contract Risk</h4>
            <p className="mt-1 text-sm">
              Contracts may contain bugs or vulnerabilities. Smart contracts have not been audited.
            </p>
          </div>

          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Market Risk</h4>
            <p className="mt-1 text-sm">
              Digital asset values are highly volatile and may fluctuate significantly.
            </p>
          </div>

          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Liquidity Risk</h4>
            <p className="mt-1 text-sm">
              You may not be able to exit positions at favorable prices.
            </p>
          </div>

          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Regulatory Risk</h4>
            <p className="mt-1 text-sm">
              Changes in laws may adversely affect the Protocol or your ability to use it.
            </p>
          </div>

          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Technology Risk</h4>
            <p className="mt-1 text-sm">
              Blockchain networks may experience congestion, failures, or technical issues.
            </p>
          </div>

          <div className="border-border rounded-lg border p-4">
            <h4 className="text-foreground font-medium">Custody Risk</h4>
            <p className="mt-1 text-sm">
              You are solely responsible for the security of your wallet and private keys.
            </p>
          </div>
        </div>
      </Section>

      <Separator />

      <Section title="6. No Warranties">
        <InfoBox>
          THE PROTOCOL IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, EXPRESS OR IMPLIED.
        </InfoBox>
        <p className="mt-4">We do not warrant that:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>The Protocol will be uninterrupted, secure, or error-free</li>
          <li>Any defects will be corrected</li>
          <li>The Protocol will meet your requirements</li>
          <li>Any information provided is accurate or complete</li>
        </ul>
      </Section>

      <Separator />

      <Section title="7. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA,
          OR OTHER INTANGIBLE LOSSES.
        </p>
      </Section>

      <Separator />

      <Section title="8. Indemnification">
        <p>
          You agree to indemnify and hold harmless the Protocol, its developers, contributors, and
          affiliates from any claims, damages, or expenses arising from your use of the Protocol.
        </p>
      </Section>

      <Separator />

      <Section title="9. Prohibited Activities">
        <p>You agree not to:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>Use the Protocol for illegal purposes</li>
          <li>Attempt to exploit or hack the smart contracts</li>
          <li>Engage in market manipulation or fraud</li>
          <li>Use the Protocol for money laundering or terrorism financing</li>
          <li>Interfere with or disrupt the Protocol</li>
          <li>Circumvent security measures</li>
        </ul>
      </Section>

      <Separator />

      <Section title="10. Modifications">
        <p>
          We reserve the right to modify these Terms at any time. Changes are effective immediately
          upon posting. Continued use constitutes acceptance of modified Terms.
        </p>
      </Section>

      <Separator />

      <Section title="11. Governing Law">
        <p>
          These Terms shall be governed by applicable laws, without regard to conflict of law
          principles. Disputes shall be resolved through binding arbitration.
        </p>
      </Section>

      <Separator />

      <Section title="12. Contact">
        <p>
          For questions about these Terms, please refer to our{' '}
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
