import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { Contract, type Call } from 'starknet';

import { useAccount, useStarknet } from '@/features/wallet';
import { getFaucetInfo } from '@/shared/config/addresses';
import { fromWad } from '@/shared/math/wad';
import { getExplorerTxUrl } from '@/shared/starknet/provider';
import { Button } from '@/shared/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/Card';

// Simple Faucet ABI - only the functions we need
const FAUCET_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [],
    outputs: [],
    state_mutability: 'external',
  },
  {
    type: 'function',
    name: 'can_mint',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'mint_amount',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    type: 'function',
    name: 'is_paused',
    inputs: [],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'view',
  },
] as const;

/**
 * Faucet page - Get test tokens for the protocol
 *
 * Features:
 * - Display faucet info (token, amount, daily limit)
 * - Mint test tokens with one click
 * - Show mint status and cooldown
 */
export default function FaucetPage(): JSX.Element {
  const { network } = useStarknet();
  const { account, isConnected } = useAccount();

  const [isMinting, setIsMinting] = createSignal(false);
  const [mintError, setMintError] = createSignal<string | null>(null);
  const [mintSuccess, setMintSuccess] = createSignal(false);
  const [txHash, setTxHash] = createSignal<string | null>(null);

  // Get faucet info for current network
  const faucetInfo = createMemo(() => getFaucetInfo(network));

  // Format the daily limit for display
  const formattedDailyLimit = createMemo(() => {
    const info = faucetInfo();
    if (!info) return '0';
    const limit = fromWad(BigInt(info.dailyLimit));
    return limit.toFixed(0);
  });

  // Handle mint action
  const handleMint = async (): Promise<void> => {
    const currentAccount = account();
    const info = faucetInfo();

    if (!currentAccount || !info) {
      setMintError('Wallet not connected or faucet not available');
      return;
    }

    setIsMinting(true);
    setMintError(null);
    setMintSuccess(false);
    setTxHash(null);

    try {
      // Create faucet contract instance
      const faucetContract = new Contract({
        abi: FAUCET_ABI,
        address: info.faucetAddress,
        providerOrAccount: currentAccount,
      });

      // Build the mint call
      const mintCall: Call = faucetContract.populate('mint', []);

      // Execute the transaction
      const result = await currentAccount.execute([mintCall]);

      setTxHash(result.transaction_hash);
      setMintSuccess(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // Parse common error messages
      if (errorMessage.includes('already minted today')) {
        setMintError('You have already claimed tokens today. Please try again tomorrow.');
      } else if (errorMessage.includes('paused')) {
        setMintError('The faucet is currently paused. Please try again later.');
      } else if (errorMessage.includes('User abort') || errorMessage.includes('rejected')) {
        setMintError('Transaction was cancelled.');
      } else {
        setMintError(`Failed to mint: ${errorMessage}`);
      }
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div class="mx-auto max-w-2xl px-4 py-8">
      {/* Page Header */}
      <div class="mb-8 text-center">
        <h1 class="text-foreground text-3xl font-semibold">Token Faucet</h1>
        <p class="text-muted-foreground mt-2">
          Get free test tokens to explore the Horizon Protocol.
        </p>
      </div>

      {/* Faucet Not Available */}
      <Show when={!faucetInfo()}>
        <Card>
          <CardContent class="py-8 text-center">
            <div class="text-muted-foreground mx-auto mb-4 h-12 w-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <h3 class="text-foreground text-lg font-medium">Faucet Not Available</h3>
            <p class="text-muted-foreground mt-2 text-sm">
              The faucet is only available on Starknet Mainnet. Please connect to Mainnet to claim
              test tokens.
            </p>
          </CardContent>
        </Card>
      </Show>

      {/* Faucet Available */}
      <Show when={faucetInfo()}>
        {(info) => (
          <div class="space-y-6">
            {/* Faucet Card */}
            <Card>
              <CardHeader>
                <CardTitle>Claim {info().tokenSymbol}</CardTitle>
                <CardDescription>
                  Get free {info().tokenName} tokens to test the protocol.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                {/* Token Info */}
                <div class="bg-muted/30 rounded-lg p-4">
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground text-sm">Token</span>
                      <span class="font-medium">{info().tokenSymbol}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground text-sm">Amount per Claim</span>
                      <span class="font-mono font-medium">{formattedDailyLimit()} tokens</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-muted-foreground text-sm">Cooldown</span>
                      <span class="text-sm">24 hours</span>
                    </div>
                  </div>
                </div>

                {/* Not Connected State */}
                <Show when={!isConnected()}>
                  <div class="bg-warning/10 border-warning/20 rounded-lg border p-4 text-center">
                    <p class="text-warning-foreground text-sm">
                      Connect your wallet to claim test tokens.
                    </p>
                  </div>
                </Show>

                {/* Connected State */}
                <Show when={isConnected()}>
                  <div class="space-y-4">
                    {/* Error Message */}
                    <Show when={mintError()}>
                      <div class="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
                        <p class="text-destructive text-sm">{mintError()}</p>
                      </div>
                    </Show>

                    {/* Success Message */}
                    <Show when={mintSuccess()}>
                      <div class="bg-success/10 border-success/20 rounded-lg border p-4">
                        <p class="text-success text-sm">
                          Successfully claimed {formattedDailyLimit()} {info().tokenSymbol}!
                        </p>
                        <Show when={txHash()}>
                          {(hash) => {
                            const explorerUrl = getExplorerTxUrl(hash(), network);
                            return (
                              <Show when={explorerUrl}>
                                <a
                                  href={explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="text-success/80 hover:text-success mt-2 inline-flex items-center gap-1 text-xs underline"
                                >
                                  View transaction
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                  </svg>
                                </a>
                              </Show>
                            );
                          }}
                        </Show>
                      </div>
                    </Show>

                    {/* Mint Button */}
                    <Button
                      class="w-full"
                      size="lg"
                      onClick={() => void handleMint()}
                      loading={isMinting()}
                      loadingText="Claiming..."
                    >
                      Claim {formattedDailyLimit()} {info().tokenSymbol}
                    </Button>
                  </div>
                </Show>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle class="text-lg">About Test Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="text-muted-foreground space-y-3 text-sm">
                  <p>
                    <strong>{info().tokenSymbol}</strong> is a mock yield-bearing token used for
                    testing the Horizon Protocol on mainnet. These tokens have no real value.
                  </p>
                  <p>
                    Each wallet can claim <strong>{formattedDailyLimit()} tokens per day</strong>.
                    Use these tokens to:
                  </p>
                  <ul class="list-inside list-disc space-y-1 pl-2">
                    <li>Mint PT and YT tokens</li>
                    <li>Trade on the PT/SY market</li>
                    <li>Provide liquidity to pools</li>
                    <li>Test yield strategies</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Show>
    </div>
  );
}
