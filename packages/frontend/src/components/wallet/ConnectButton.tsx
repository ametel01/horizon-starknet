'use client';

import { useStarknet } from '@/hooks/useStarknet';
import { formatAddress } from '@/lib/starknet/wallet';

import { Button } from '../ui/Button';

export function ConnectButton(): React.ReactNode {
  const { address, isConnected, isConnecting, connect, disconnect } = useStarknet();

  if (isConnected && address) {
    return (
      <Button variant="secondary" onClick={() => void disconnect()}>
        {formatAddress(address)}
      </Button>
    );
  }

  return (
    <Button onClick={() => void connect()} disabled={isConnecting}>
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}
