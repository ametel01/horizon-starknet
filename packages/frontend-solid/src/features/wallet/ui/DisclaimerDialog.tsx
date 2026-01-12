import { A } from '@solidjs/router';
import { Button } from '@shared/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/Dialog';
import { Separator } from '@shared/ui/Separator';
import { createEffect, createSignal, type JSX } from 'solid-js';

/** Inline SVG AlertTriangle icon */
function AlertTriangleIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      aria-hidden="true"
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** Inline SVG FlaskConical icon */
function FlaskConicalIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      aria-hidden="true"
      {...props}
    >
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}

/** Inline SVG ExternalLink icon */
function ExternalLinkIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      aria-hidden="true"
      {...props}
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

interface DisclaimerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when user accepts the terms */
  onAccept: () => void;
}

/**
 * DisclaimerDialog displays important warnings and terms before wallet connection.
 *
 * Features:
 * - Experimental protocol warning
 * - Risk disclosure about funds
 * - Link to faucet for test tokens
 * - Terms acceptance checkbox
 * - Accept & Connect / Cancel actions
 */
export function DisclaimerDialog(props: DisclaimerDialogProps): JSX.Element {
  const [acknowledged, setAcknowledged] = createSignal(false);

  // Reset acknowledged state when dialog opens
  createEffect(() => {
    if (props.open) {
      setAcknowledged(false);
    }
  });

  const handleAccept = (): void => {
    if (acknowledged()) {
      props.onAccept();
      props.onOpenChange(false);
    }
  };

  const handleClose = (): void => {
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent showCloseButton={false} class="sm:max-w-lg">
        <DialogHeader>
          <div class="bg-warning/10 border-warning/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border">
            <AlertTriangleIcon class="text-warning h-6 w-6" />
          </div>
          <DialogTitle class="text-center text-xl">Important Disclaimer</DialogTitle>
          <DialogDescription class="text-center">
            Please read carefully before connecting your wallet
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          {/* Experimental Warning */}
          <div class="border-destructive/20 bg-destructive/5 rounded-lg border p-4">
            <div class="flex items-start gap-3">
              <FlaskConicalIcon class="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h4 class="text-foreground font-medium">Experimental Protocol</h4>
                <p class="text-muted-foreground mt-1 text-sm">
                  Horizon Protocol is in <strong>experimental mode</strong>. Smart contracts have{' '}
                  <strong>not been audited</strong>. Use at your own risk.
                </p>
              </div>
            </div>
          </div>

          {/* Risk Warning */}
          <div class="border-warning/20 bg-warning/5 rounded-lg border p-4">
            <div class="flex items-start gap-3">
              <AlertTriangleIcon class="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <h4 class="text-foreground font-medium">Funds at Risk</h4>
                <p class="text-muted-foreground mt-1 text-sm">
                  You may lose some or all of your funds. Never deposit more than you can afford to
                  lose. This is not financial advice.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Faucet Info */}
          <div class="border-primary/20 bg-primary/5 rounded-lg border p-4">
            <h4 class="text-foreground mb-2 font-medium">Get Test Tokens</h4>
            <p class="text-muted-foreground text-sm">
              The protocol currently uses <strong>mock yield tokens</strong> for testing. Get free
              test tokens from our faucet to try out the protocol safely.
            </p>
            <A
              href="/faucet"
              class="text-primary hover:text-primary/80 mt-3 inline-flex items-center gap-1 text-sm font-medium"
              onClick={handleClose}
            >
              Go to Faucet
              <ExternalLinkIcon class="h-3.5 w-3.5" />
            </A>
          </div>

          {/* Acknowledgment Checkbox */}
          <label class="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors">
            <input
              type="checkbox"
              checked={acknowledged()}
              onChange={(e) => {
                setAcknowledged(e.currentTarget.checked);
              }}
              class="border-border bg-background accent-primary mt-0.5 h-5 w-5 rounded border"
            />
            <span class="text-muted-foreground text-sm">
              I understand the risks and accept the{' '}
              <A
                href="/terms"
                class="text-primary hover:text-primary/80 underline"
                onClick={handleClose}
              >
                Terms of Service
              </A>
            </span>
          </label>
        </div>

        <DialogFooter class="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} class="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!acknowledged()} class="flex-1 sm:flex-none">
            Accept & Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
