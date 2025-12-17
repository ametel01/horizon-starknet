'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useStarknet } from '@/hooks/useStarknet';
import { formatAddress } from '@/lib/starknet/wallet';

import { DisclaimerDialog } from './DisclaimerDialog';

export function ConnectButton(): React.ReactNode {
  const { address, isConnected, isConnecting, connect, disconnect } = useStarknet();
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleConnectClick = (): void => {
    setShowDisclaimer(true);
  };

  const handleAcceptDisclaimer = (): void => {
    void connect();
  };

  if (isConnected && address) {
    return (
      <Button variant="secondary" onClick={() => void disconnect()}>
        {formatAddress(address)}
      </Button>
    );
  }

  return (
    <>
      <Button onClick={handleConnectClick} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
      <DisclaimerDialog
        open={showDisclaimer}
        onOpenChange={setShowDisclaimer}
        onAccept={handleAcceptDisclaimer}
      />
    </>
  );
}
