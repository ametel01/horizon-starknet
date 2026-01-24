'use client';

import { Button } from '@shared/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog';
import { Separator } from '@shared/ui/separator';
import { AlertTriangle, ExternalLink, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface DisclaimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

export function DisclaimerDialog({
  open,
  onOpenChange,
  onAccept,
}: DisclaimerDialogProps): React.ReactNode {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleAccept = (): void => {
    if (acknowledged) {
      onAccept();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <div className="bg-warning/10 border-warning/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border">
            <AlertTriangle className="text-warning h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-xl">Important Disclaimer</DialogTitle>
          <DialogDescription className="text-center">
            Please read carefully before connecting your wallet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Experimental Warning */}
          <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <FlaskConical className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h4 className="text-foreground font-medium">Experimental Protocol</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  Horizon Protocol is in <strong>experimental mode</strong>. Smart contracts have{' '}
                  <strong>not been audited</strong>. Use at your own risk.
                </p>
              </div>
            </div>
          </div>

          {/* Risk Warning */}
          <div className="border-warning/20 bg-warning/5 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h4 className="text-foreground font-medium">Funds at Risk</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  You may lose some or all of your funds. Never deposit more than you can afford to
                  lose. This is not financial advice.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Faucet Info */}
          <div className="border-primary/20 bg-primary/5 rounded-lg border p-4">
            <h4 className="text-foreground mb-2 font-medium">Get Test Tokens</h4>
            <p className="text-muted-foreground text-sm">
              The protocol currently uses <strong>mock yield tokens</strong> for testing. Get free
              test tokens from our faucet to try out the protocol safely.
            </p>
            <Link
              href="/faucet"
              className="text-primary hover:text-primary/80 mt-3 inline-flex items-center gap-1 text-sm font-medium"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Go to Faucet
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Acknowledgment Checkbox */}
          <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors">
            <input
              type="checkbox"
              name="acknowledge-risks"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
              }}
              className="border-border bg-background accent-primary mt-0.5 h-5 w-5 rounded border"
            />
            <span className="text-muted-foreground text-sm">
              I understand the risks and accept the{' '}
              <Link
                href="/terms"
                className="text-primary hover:text-primary/80 underline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Terms of Service
              </Link>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!acknowledged} className="flex-1 sm:flex-none">
            Accept & Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
