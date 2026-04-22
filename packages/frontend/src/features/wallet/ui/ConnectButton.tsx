'use client';

import { useStarknet } from '@features/wallet';
import { formatAddress } from '@shared/starknet/wallet';
import { Button } from '@shared/ui/Button';
import { useState } from 'react';

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
