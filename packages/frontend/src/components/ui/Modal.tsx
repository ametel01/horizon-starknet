'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Modal({ open, onOpenChange, children }: ModalProps): ReactNode {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

interface ModalTriggerProps {
  children: ReactNode;
  asChild?: boolean;
}

export function ModalTrigger({ children, asChild = false }: ModalTriggerProps): ReactNode {
  return <Dialog.Trigger asChild={asChild}>{children}</Dialog.Trigger>;
}

interface ModalContentProps {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}

export function ModalContent({
  children,
  className,
  title,
  description,
}: ModalContentProps): ReactNode {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className
        )}
      >
        {title ? (
          <Dialog.Title className="mb-2 text-lg font-semibold text-neutral-100">
            {title}
          </Dialog.Title>
        ) : null}
        {description ? (
          <Dialog.Description className="mb-4 text-sm text-neutral-400">
            {description}
          </Dialog.Description>
        ) : null}
        {children}
        <Dialog.Close
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-neutral-900"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-400"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps): ReactNode {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-3', className)}>{children}</div>
  );
}
