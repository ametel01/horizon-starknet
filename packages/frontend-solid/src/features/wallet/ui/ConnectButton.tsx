import { formatAddress } from '@shared/starknet/wallet';
import { Button } from '@shared/ui/Button';
import { Show, type JSX } from 'solid-js';
import { useStarknet } from '../model/useStarknet';

/**
 * Wallet connection button that displays connection status.
 *
 * - Shows "Connect Wallet" when disconnected
 * - Shows "Connecting..." while connecting
 * - Shows truncated address when connected (click to disconnect)
 */
export function ConnectButton(): JSX.Element {
  const { address, isConnected, isConnecting, connect, disconnect } = useStarknet();

  const handleConnect = (): void => {
    void connect();
  };

  const handleDisconnect = (): void => {
    void disconnect();
  };

  return (
    <Show
      when={isConnected() && address()}
      fallback={
        <Button onClick={handleConnect} disabled={isConnecting()} loading={isConnecting()}>
          {isConnecting() ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      }
    >
      <Button variant="secondary" onClick={handleDisconnect}>
        {formatAddress(address()!)}
      </Button>
    </Show>
  );
}
