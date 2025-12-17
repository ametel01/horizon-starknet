'use client';

import { AlertTriangle, Check, Copy, Droplets, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Call } from 'starknet';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Separator } from '@/components/ui/separator';
import { useStarknet } from '@/hooks/useStarknet';
import { useTransaction } from '@/hooks/useTransaction';
import { getFaucetInfo } from '@/lib/constants/addresses';
import { getFaucetContract } from '@/lib/starknet/contracts';

export default function FaucetPage(): React.ReactNode {
  const { address, isConnected, provider, network } = useStarknet();
  const { execute, status, reset } = useTransaction();
  const [inputAddress, setInputAddress] = useState('');
  const [canMint, setCanMint] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const faucetInfo = getFaucetInfo(network);
  const targetAddress = isConnected && address ? address : inputAddress;
  const isMinting = status === 'signing' || status === 'pending';
  const mintSuccess = status === 'success';

  // Check if address can mint
  const checkCanMint = useCallback(async () => {
    if (!faucetInfo || !targetAddress) {
      setCanMint(null);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const faucet = getFaucetContract(faucetInfo.faucetAddress, provider);
      const result = await faucet.can_mint(targetAddress);
      setCanMint(result);
    } catch (err) {
      console.error('Error checking can_mint:', err);
      setError('Failed to check mint status');
      setCanMint(null);
    } finally {
      setIsChecking(false);
    }
  }, [faucetInfo, targetAddress, provider]);

  // Check on mount and when address changes
  useEffect(() => {
    if (targetAddress) {
      void checkCanMint();
    }
  }, [targetAddress, checkCanMint]);

  // Reset on success and recheck
  useEffect(() => {
    if (mintSuccess) {
      setCanMint(false);
    }
  }, [mintSuccess]);

  // Handle mint
  const handleMint = async (): Promise<void> => {
    if (!faucetInfo || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setError(null);
    reset();

    try {
      const mintCall: Call = {
        contractAddress: faucetInfo.faucetAddress,
        entrypoint: 'mint',
        calldata: [],
      };

      await execute(mintCall);
    } catch (err) {
      console.error('Mint error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to mint tokens';
      if (errorMessage.includes('already minted')) {
        setError('You have already minted today. Please try again in 24 hours.');
      } else {
        setError(errorMessage);
      }
    }
  };

  // Copy token address
  const copyTokenAddress = (): void => {
    if (faucetInfo) {
      void navigator.clipboard.writeText(faucetInfo.tokenAddress);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  };

  // If faucet not available on this network
  if (!faucetInfo) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <AlertTriangle className="text-warning mx-auto h-12 w-12" />
          <h1 className="text-foreground mt-4 text-xl font-bold">Faucet Not Available</h1>
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
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to App
      </Link>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <Droplets className="text-primary h-8 w-8" />
        </div>
        <h1 className="text-foreground text-2xl font-bold">Test Token Faucet</h1>
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
          <label className="text-foreground mb-2 block text-sm font-medium">
            Token Contract Address
          </label>
          <p className="text-muted-foreground mb-2 text-xs">
            Add this token to your wallet to see your balance
          </p>
          <div className="flex gap-2">
            <Input
              value={faucetInfo.tokenAddress}
              readOnly
              className="bg-muted font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={copyTokenAddress}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Wallet Address */}
        <div>
          <label className="text-foreground mb-2 block text-sm font-medium">Your Wallet</label>
          {isConnected && address ? (
            <Input value={address} readOnly className="bg-muted font-mono text-xs" />
          ) : (
            <div className="space-y-2">
              <Input
                value={inputAddress}
                onChange={(e) => {
                  setInputAddress(e.target.value);
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
            {isChecking ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking eligibility...
              </div>
            ) : canMint === false ? (
              <div className="border-warning/20 bg-warning/5 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-foreground font-medium">Already minted today</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can only mint once every 24 hours. Please try again later.
                    </p>
                  </div>
                </div>
              </div>
            ) : canMint === true ? (
              <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-foreground font-medium">Eligible to mint</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      You can claim your 100 {faucetInfo.tokenSymbol} test tokens.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="border-destructive/20 bg-destructive/5 mt-4 rounded-lg border p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Success */}
        {mintSuccess && (
          <div className="border-primary/20 bg-primary/5 mt-4 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Check className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Minting...
                </>
              ) : (
                <>
                  <Droplets className="mr-2 h-4 w-4" />
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
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
