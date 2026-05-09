'use client';

import { useStarknet } from '@features/wallet';
import { getFaucetInfo } from '@shared/config/addresses';
import { useTransaction } from '@shared/hooks/useTransaction';
import { logError } from '@shared/server/logger';
import { Button } from '@shared/ui/Button';
import { Input } from '@shared/ui/Input';
import { Separator } from '@shared/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, Droplets, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useReducer } from 'react';
import type { Call, ProviderInterface } from 'starknet';
import { Contract } from 'starknet';

/**
 * Minimal Faucet ABI for can_mint and mint functions.
 *
 * Note: Faucet is test infrastructure, not a production contract, so its ABI
 * is not included in the generated types. This inline definition provides
 * only the two functions needed for this page. If the Faucet contract changes,
 * update this ABI accordingly.
 */
const FAUCET_ABI = [
  {
    type: 'function',
    name: 'can_mint',
    inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [],
    outputs: [],
    state_mutability: 'external',
  },
] as const;

function getFaucetContract(address: string, provider: ProviderInterface) {
  return new Contract({ abi: FAUCET_ABI, address, providerOrAccount: provider });
}

/**
 * Eligibility status component - extracted to reduce complexity.
 */
interface EligibilityStatusProps {
  isChecking: boolean;
  canMint: boolean | null;
  tokenSymbol: string;
}

function EligibilityStatus({
  isChecking,
  canMint,
  tokenSymbol,
}: EligibilityStatusProps): React.ReactNode {
  if (isChecking) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Checking eligibility…
      </div>
    );
  }

  if (canMint === false) {
    return (
      <div className="border-warning/20 bg-warning/5 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-warning mt-0.5 size-5 flex-shrink-0" />
          <div>
            <p className="text-foreground font-medium">Already minted today</p>
            <p className="text-muted-foreground mt-1 text-sm">
              You can only mint once every 24 hours. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (canMint === true) {
    return (
      <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
        <div className="flex items-start gap-3">
          <Check className="text-primary mt-0.5 size-5 flex-shrink-0" />
          <div>
            <p className="text-foreground font-medium">Eligible to mint</p>
            <p className="text-muted-foreground mt-1 text-sm">
              You can claim your 100 {tokenSymbol} test tokens.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function FaucetPage(): React.ReactNode {
  return useFaucetPageContent();
}

interface FaucetState {
  inputAddress: string;
  error: string | null;
  copied: boolean;
}

type FaucetAction =
  | { type: 'setInputAddress'; value: string }
  | { type: 'setError'; error: string | null }
  | { type: 'setCopied'; copied: boolean };

const INITIAL_FAUCET_STATE: FaucetState = {
  inputAddress: '',
  error: null,
  copied: false,
};

function faucetReducer(state: FaucetState, action: FaucetAction): FaucetState {
  switch (action.type) {
    case 'setInputAddress':
      return { ...state, inputAddress: action.value };
    case 'setError':
      return { ...state, error: action.error };
    case 'setCopied':
      return { ...state, copied: action.copied };
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Faucet page coordinates eligibility checks, transaction status, copy feedback, and several empty/error/success states.
function useFaucetPageContent(): React.ReactNode {
  const { address, isConnected, provider, network } = useStarknet();
  const { execute, status, reset } = useTransaction();
  const [state, dispatch] = useReducer(faucetReducer, INITIAL_FAUCET_STATE);
  const { inputAddress, error, copied } = state;

  const faucetInfo = getFaucetInfo(network);
  const targetAddress = isConnected && address ? address : inputAddress;
  const isMinting = status === 'signing' || status === 'pending';
  const mintSuccess = status === 'success';

  const canMintQuery = useQuery({
    queryKey: ['faucet-can-mint', network, faucetInfo?.faucetAddress, targetAddress],
    enabled: Boolean(faucetInfo && targetAddress),
    queryFn: async () => {
      if (!faucetInfo || !targetAddress) return null;
      const faucet = getFaucetContract(faucetInfo.faucetAddress, provider);
      try {
        const result = await faucet['can_mint'](targetAddress);
        // Starknet returns booleans as bigint (0n/1n) for untyped contracts.
        return result === 1n || result === true;
      } catch (err) {
        logError(err, { module: 'faucet', action: 'checkCanMint', targetAddress });
        throw err;
      }
    },
  });

  const canMint = mintSuccess ? false : (canMintQuery.data ?? null);
  const isChecking = canMintQuery.isFetching;
  const displayedError = error ?? (canMintQuery.isError ? 'Failed to check mint status' : null);

  // Handle mint
  const handleMint = async (): Promise<void> => {
    if (!faucetInfo || !isConnected) {
      dispatch({ type: 'setError', error: 'Please connect your wallet first' });
      return;
    }

    dispatch({ type: 'setError', error: null });
    reset();

    try {
      const mintCall: Call = {
        contractAddress: faucetInfo.faucetAddress,
        entrypoint: 'mint',
        calldata: [],
      };

      await execute(mintCall);
    } catch (err) {
      logError(err, { module: 'faucet', action: 'mint' });
      const errorMessage = err instanceof Error ? err.message : 'Failed to mint tokens';
      if (errorMessage.includes('already minted')) {
        dispatch({
          type: 'setError',
          error: 'You have already minted today. Please try again in 24 hours.',
        });
      } else {
        dispatch({ type: 'setError', error: errorMessage });
      }
    }
  };

  // Copy token address
  const copyTokenAddress = (): void => {
    if (faucetInfo) {
      void navigator.clipboard.writeText(faucetInfo.tokenAddress);
      dispatch({ type: 'setCopied', copied: true });
      setTimeout(() => {
        dispatch({ type: 'setCopied', copied: false });
      }, 2000);
    }
  };

  // If faucet not available on this network
  if (!faucetInfo) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <AlertTriangle className="text-warning mx-auto size-12" />
          <h1 className="text-foreground mt-4 text-xl font-semibold">Faucet Not Available</h1>
          <p className="text-muted-foreground mt-2">
            The faucet is only available on Starknet mainnet for testing purposes.
          </p>
          <Link href="/">
            <Button className="mt-6">Go to App</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {/* Back link */}
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to App
      </Link>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
          <Droplets className="text-primary size-8" />
        </div>
        <h1 className="text-foreground text-2xl font-semibold">Test Token Faucet</h1>
        <p className="text-muted-foreground mt-2">
          Get free hrzSTRK tokens to test Horizon Protocol
        </p>
      </div>

      {/* Main Card */}
      <div className="border-border bg-card rounded-lg border p-6">
        {/* Token Info */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground font-medium">You will receive</p>
              <p className="text-primary text-2xl font-bold">100 {faucetInfo.tokenSymbol}</p>
            </div>
            <div className="text-muted-foreground text-right text-sm">
              <p>Once per 24 hours</p>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Token Address */}
        <div>
          <label
            htmlFor="faucet-token-address"
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Token Contract Address
          </label>
          <p className="text-muted-foreground mb-2 text-xs">
            Add this token to your wallet to see your balance
          </p>
          <div className="flex gap-2">
            <Input
              id="faucet-token-address"
              value={faucetInfo.tokenAddress}
              readOnly
              className="bg-muted font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={copyTokenAddress}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Wallet Address */}
        <div>
          <label
            htmlFor={isConnected && address ? 'faucet-connected-wallet' : 'faucet-wallet-address'}
            className="text-foreground mb-2 block text-sm font-medium"
          >
            Your Wallet
          </label>
          {isConnected && address ? (
            <Input
              id="faucet-connected-wallet"
              value={address}
              readOnly
              className="bg-muted font-mono text-xs"
            />
          ) : (
            <div className="space-y-2">
              <Input
                id="faucet-wallet-address"
                value={inputAddress}
                onChange={(e) => {
                  dispatch({ type: 'setInputAddress', value: e.target.value });
                }}
                placeholder="0x..."
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                Connect your wallet or enter an address to check eligibility
              </p>
            </div>
          )}
        </div>

        {/* Status */}
        {targetAddress && (
          <div className="mt-6">
            <EligibilityStatus
              isChecking={isChecking}
              canMint={canMint}
              tokenSymbol={faucetInfo.tokenSymbol}
            />
          </div>
        )}

        {/* Error */}
        {displayedError && (
          <div className="border-destructive/20 bg-destructive/5 mt-4 rounded-lg border p-4">
            <p className="text-destructive text-sm">{displayedError}</p>
          </div>
        )}

        {/* Success */}
        {mintSuccess && (
          <div className="border-primary/20 bg-primary/5 mt-4 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Check className="text-primary mt-0.5 size-5 flex-shrink-0" />
              <div>
                <p className="text-foreground font-medium">Tokens minted successfully!</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  100 {faucetInfo.tokenSymbol} have been sent to your wallet.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mint Button */}
        <div className="mt-6">
          {isConnected ? (
            <Button
              onClick={() => void handleMint()}
              disabled={isMinting || canMint === false || !canMint}
              className="w-full"
            >
              {isMinting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Minting…
                </>
              ) : (
                <>
                  <Droplets className="mr-2 size-4" />
                  Mint 100 {faucetInfo.tokenSymbol}
                </>
              )}
            </Button>
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              Connect your wallet to mint tokens
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 space-y-3 text-center">
        <p className="text-muted-foreground text-sm">
          These are test tokens with no real value. Use them to explore Horizon Protocol.
        </p>
        <Link
          href="/docs/getting-started"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm"
        >
          Learn how to use Horizon
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
