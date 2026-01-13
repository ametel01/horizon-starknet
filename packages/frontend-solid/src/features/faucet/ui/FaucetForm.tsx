import { cn } from '@shared/lib/utils';
import { getExplorerTxUrl } from '@shared/starknet/provider';
import { Alert, AlertDescription, AlertTitle } from '@shared/ui/Alert';
import { Button } from '@shared/ui/Button';
import { Card, CardContent } from '@shared/ui/Card';
import { Input } from '@shared/ui/Input';
import { Separator } from '@shared/ui/Separator';
import { createSignal, type JSX, Show } from 'solid-js';
import { useStarknet } from '@/features/wallet';

import { useFaucet } from '../model/useFaucet';

export interface FaucetFormProps {
  class?: string;
}

/**
 * Droplets icon
 */
function DropletsIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </svg>
  );
}

/**
 * AlertTriangle icon
 */
function AlertTriangleIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * Check icon
 */
function CheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Copy icon
 */
function CopyIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

/**
 * Loader icon with spin animation
 */
function LoaderIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={cn('animate-spin', props.class)}
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * External link icon
 */
function ExternalLinkIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      {...props}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/**
 * Eligibility status display component
 */
interface EligibilityStatusProps {
  isChecking: boolean;
  canMint: boolean | null;
  tokenSymbol: string;
}

function EligibilityStatus(props: EligibilityStatusProps): JSX.Element {
  return (
    <>
      <Show when={props.isChecking}>
        <div class="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderIcon class="h-4 w-4" />
          Checking eligibility...
        </div>
      </Show>

      <Show when={!props.isChecking && props.canMint === false}>
        <Alert variant="warning">
          <AlertTriangleIcon class="h-5 w-5" />
          <AlertTitle>Already minted today</AlertTitle>
          <AlertDescription>
            You can only mint once every 24 hours. Please try again later.
          </AlertDescription>
        </Alert>
      </Show>

      <Show when={!props.isChecking && props.canMint === true}>
        <Alert variant="info">
          <CheckIcon class="h-5 w-5" />
          <AlertTitle>Eligible to mint</AlertTitle>
          <AlertDescription>
            You can claim your 100 {props.tokenSymbol} test tokens.
          </AlertDescription>
        </Alert>
      </Show>
    </>
  );
}

/**
 * FaucetForm - SolidJS component for minting test tokens from the faucet.
 *
 * Features:
 * - Eligibility checking before mint
 * - Token address copy to clipboard
 * - Transaction status feedback
 * - Only available on mainnet for hrzSTRK tokens
 */
export function FaucetForm(props: FaucetFormProps): JSX.Element {
  const { address, isConnected, network } = useStarknet();
  const [copied, setCopied] = createSignal(false);

  const {
    canMint,
    isCheckingEligibility,
    mint,
    isMinting,
    isSuccess,
    isError,
    error,
    transactionHash,
    reset,
    faucetAvailable,
    tokenSymbol,
    tokenAddress,
  } = useFaucet();

  // Copy token address to clipboard
  const copyTokenAddress = (): void => {
    const addr = tokenAddress();
    if (addr) {
      void navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle mint action
  const handleMint = (): void => {
    if (!isConnected() || isMinting() || canMint() !== true) return;
    mint();
  };

  // Reset after success
  const handleReset = (): void => {
    reset();
  };

  // Faucet not available on this network
  if (!faucetAvailable()) {
    return (
      <div class={cn('mx-auto max-w-lg px-4 py-12', props.class)}>
        <Card class="p-8 text-center">
          <CardContent class="space-y-4">
            <AlertTriangleIcon class="text-warning mx-auto h-12 w-12" />
            <h1 class="text-foreground text-xl font-bold">Faucet Not Available</h1>
            <p class="text-muted-foreground">
              The faucet is only available on Starknet mainnet for testing purposes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div class={cn('mx-auto max-w-lg px-4 py-12', props.class)}>
      {/* Header */}
      <div class="mb-8 text-center">
        <div class="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <DropletsIcon class="text-primary h-8 w-8" />
        </div>
        <h1 class="text-foreground text-2xl font-bold">Test Token Faucet</h1>
        <p class="text-muted-foreground mt-2">
          Get free {tokenSymbol()} tokens to test Horizon Protocol
        </p>
      </div>

      {/* Main Card */}
      <Card class="p-6">
        <CardContent class="space-y-6">
          {/* Token Info */}
          <div class="bg-muted/50 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-foreground font-medium">You will receive</p>
                <p class="text-primary text-2xl font-bold">100 {tokenSymbol()}</p>
              </div>
              <div class="text-muted-foreground text-right text-sm">
                <p>Once per 24 hours</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Token Address */}
          <div>
            <label class="text-foreground mb-2 block text-sm font-medium">
              Token Contract Address
            </label>
            <p class="text-muted-foreground mb-2 text-xs">
              Add this token to your wallet to see your balance
            </p>
            <div class="flex gap-2">
              <Input value={tokenAddress()} readOnly class="bg-muted font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyTokenAddress}>
                <Show when={copied()} fallback={<CopyIcon class="h-4 w-4" />}>
                  <CheckIcon class="h-4 w-4" />
                </Show>
              </Button>
            </div>
          </div>

          <Separator />

          {/* Wallet Address */}
          <div>
            <label class="text-foreground mb-2 block text-sm font-medium">Your Wallet</label>
            <Show
              when={isConnected() && address()}
              fallback={
                <p class="text-muted-foreground text-sm">
                  Connect your wallet to check eligibility and mint tokens
                </p>
              }
            >
              <Input value={address() ?? ''} readOnly class="bg-muted font-mono text-xs" />
            </Show>
          </div>

          {/* Eligibility Status */}
          <Show when={isConnected() && address()}>
            <EligibilityStatus
              isChecking={isCheckingEligibility()}
              canMint={canMint()}
              tokenSymbol={tokenSymbol()}
            />
          </Show>

          {/* Error Message */}
          <Show when={isError() && error()}>
            <Alert variant="destructive">
              <AlertTriangleIcon class="h-5 w-5" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error()?.message}</AlertDescription>
            </Alert>
          </Show>

          {/* Success Message */}
          <Show when={isSuccess()}>
            <Alert variant="info">
              <CheckIcon class="h-5 w-5" />
              <AlertTitle>Tokens minted successfully!</AlertTitle>
              <AlertDescription>
                <p>100 {tokenSymbol()} have been sent to your wallet.</p>
                <Show when={transactionHash()}>
                  {(hash) => {
                    const explorerUrl = getExplorerTxUrl(hash(), network);
                    return (
                      <Show when={explorerUrl}>
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-primary hover:text-primary/80 mt-1 inline-flex items-center gap-1 text-xs underline"
                        >
                          View transaction
                          <ExternalLinkIcon class="h-3 w-3" />
                        </a>
                      </Show>
                    );
                  }}
                </Show>
              </AlertDescription>
            </Alert>
          </Show>

          {/* Mint Button */}
          <div>
            <Show
              when={isConnected()}
              fallback={
                <p class="text-muted-foreground text-center text-sm">
                  Connect your wallet to mint tokens
                </p>
              }
            >
              <Show
                when={!isSuccess()}
                fallback={
                  <Button onClick={handleReset} variant="default" size="lg" class="w-full">
                    Mint More
                  </Button>
                }
              >
                <Button
                  onClick={handleMint}
                  disabled={isMinting() || canMint() !== true}
                  loading={isMinting()}
                  size="lg"
                  class="w-full"
                >
                  <Show when={!isMinting()} fallback="Minting...">
                    <DropletsIcon class="mr-2 h-4 w-4" />
                    Mint 100 {tokenSymbol()}
                  </Show>
                </Button>
              </Show>
            </Show>
          </div>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div class="mt-6 space-y-3 text-center">
        <p class="text-muted-foreground text-sm">
          These are test tokens with no real value. Use them to explore Horizon Protocol.
        </p>
      </div>
    </div>
  );
}
