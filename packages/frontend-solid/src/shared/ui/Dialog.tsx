import { Dialog } from '@kobalte/core/dialog';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, Show, splitProps } from 'solid-js';
import { Button } from './Button';

/** Inline SVG X icon (avoids lucide dependency) */
function XIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// In Kobalte, Dialog itself is the Root component
// Dialog.Root is an alias for Dialog (deprecated)
type DialogRootProps = ComponentProps<typeof Dialog>;

/**
 * Dialog root component that contains all dialog parts.
 *
 * Uses Kobalte Dialog primitive which follows WAI-ARIA Dialog pattern.
 * - Modal focus trapping
 * - Screen reader announcements
 * - Escape key to close
 */
function DialogRoot(props: DialogRootProps): JSX.Element {
  return <Dialog data-slot="dialog" {...props} />;
}

type DialogTriggerProps = ComponentProps<typeof Dialog.Trigger>;

function DialogTrigger(props: DialogTriggerProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return <Dialog.Trigger data-slot="dialog-trigger" class={cn(local.class)} {...others} />;
}

type DialogPortalProps = ComponentProps<typeof Dialog.Portal>;

function DialogPortal(props: DialogPortalProps): JSX.Element {
  return <Dialog.Portal data-slot="dialog-portal" {...props} />;
}

type DialogCloseProps = ComponentProps<typeof Dialog.CloseButton>;

function DialogClose(props: DialogCloseProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return <Dialog.CloseButton data-slot="dialog-close" class={cn(local.class)} {...others} />;
}

type DialogOverlayProps = ComponentProps<typeof Dialog.Overlay>;

function DialogOverlay(props: DialogOverlayProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Dialog.Overlay
      data-slot="dialog-overlay"
      class={cn(
        // Base overlay styles
        'fixed inset-0 isolate z-50 bg-black/60 backdrop-blur-sm',
        // Animation classes using Kobalte's data-expanded attribute
        'data-[expanded]:animate-in data-[closed]:animate-out',
        'data-[closed]:fade-out-0 data-[expanded]:fade-in-0',
        'duration-100',
        local.class
      )}
      {...others}
    />
  );
}

type DialogContentProps = ComponentProps<typeof Dialog.Content> & {
  /** Show close button in top-right corner (default: true) */
  showCloseButton?: boolean;
};

function DialogContent(props: DialogContentProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children', 'showCloseButton']);

  return (
    <DialogPortal>
      <DialogOverlay />
      <Dialog.Content
        data-slot="dialog-content"
        class={cn(
          // Base content styles
          'ring-foreground/5 bg-background fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-4xl p-6 text-sm ring-1 outline-none sm:max-w-md',
          // Animation classes using Kobalte's data-expanded attribute
          'data-[expanded]:animate-in data-[closed]:animate-out',
          'data-[closed]:fade-out-0 data-[expanded]:fade-in-0',
          'data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95',
          'duration-100',
          local.class
        )}
        {...others}
      >
        {local.children}
        <Show when={local.showCloseButton !== false}>
          <Dialog.CloseButton
            data-slot="dialog-close"
            class="absolute top-4 right-4"
            as={Button}
            variant="ghost"
            size="icon-sm"
          >
            <XIcon />
            <span class="sr-only">Close</span>
          </Dialog.CloseButton>
        </Show>
      </Dialog.Content>
    </DialogPortal>
  );
}

type DialogHeaderProps = ComponentProps<'div'>;

function DialogHeader(props: DialogHeaderProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <div data-slot="dialog-header" class={cn('flex flex-col gap-2', local.class)} {...others} />
  );
}

type DialogFooterProps = ComponentProps<'div'> & {
  /** Show close button in footer (default: false) */
  showCloseButton?: boolean;
};

function DialogFooter(props: DialogFooterProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children', 'showCloseButton']);

  return (
    <div
      data-slot="dialog-footer"
      class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', local.class)}
      {...others}
    >
      {local.children}
      <Show when={local.showCloseButton}>
        <Dialog.CloseButton as={Button} variant="outline">
          Close
        </Dialog.CloseButton>
      </Show>
    </div>
  );
}

type DialogTitleProps = ComponentProps<typeof Dialog.Title>;

function DialogTitle(props: DialogTitleProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Dialog.Title
      data-slot="dialog-title"
      class={cn('text-base leading-none font-medium', local.class)}
      {...others}
    />
  );
}

type DialogDescriptionProps = ComponentProps<typeof Dialog.Description>;

function DialogDescription(props: DialogDescriptionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <Dialog.Description
      data-slot="dialog-description"
      class={cn(
        '*:[a]:hover:text-foreground text-muted-foreground text-sm *:[a]:underline *:[a]:underline-offset-3',
        local.class
      )}
      {...others}
    />
  );
}

// Export Dialog namespace for direct access to Kobalte primitives
// Usage: Dialog.Root, Dialog.Trigger, etc.
export { Dialog };

// Export wrapper components
export {
  DialogRoot,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

export type {
  DialogCloseProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogOverlayProps,
  DialogPortalProps,
  DialogRootProps,
  DialogTitleProps,
  DialogTriggerProps,
};
