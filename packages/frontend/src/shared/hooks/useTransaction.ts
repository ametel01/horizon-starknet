'use client';

import { useCallback, useState } from 'react';
import type { Call, InvokeFunctionResponse } from 'starknet';

import { useAccount } from '@/hooks/useAccount';
import { useStarknet } from '@/hooks/useStarknet';

export type TransactionStatus = 'idle' | 'signing' | 'pending' | 'success' | 'error';
export type TxStatus = TransactionStatus;

export interface UseTransactionReturn {
  execute: (calls: Call | Call[]) => Promise<InvokeFunctionResponse | null>;
  status: TransactionStatus;
  txHash: string | null;
  error: Error | null;
  isLoading: boolean;
  reset: () => void;
}

export function useTransaction(): UseTransactionReturn {
  const { provider } = useStarknet();
  const { account } = useAccount();

  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const isLoading = status === 'signing' || status === 'pending';

  const execute = useCallback(
    async (calls: Call | Call[]): Promise<InvokeFunctionResponse | null> => {
      if (!account) {
        setError(new Error('Wallet not connected'));
        setStatus('error');
        return null;
      }

      const callArray = Array.isArray(calls) ? calls : [calls];

      try {
        setStatus('signing');
        setError(null);
        setTxHash(null);

        // Execute the transaction (single or multicall)
        const response = await account.execute(callArray);
        setTxHash(response.transaction_hash);
        setStatus('pending');

        // Wait for transaction to be accepted
        await provider.waitForTransaction(response.transaction_hash);
        setStatus('success');

        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transaction failed');
        setError(error);
        setStatus('error');
        return null;
      }
    },
    [account, provider]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setError(null);
  }, []);

  return {
    execute,
    status,
    txHash,
    error,
    isLoading,
    reset,
  };
}
