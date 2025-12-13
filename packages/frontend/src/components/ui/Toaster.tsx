'use client';

import { type ReactNode } from 'react';

import { useToast } from '@/hooks/useToast';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './Toast';

export function Toaster(): ReactNode {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map((toastItem) => (
        <Toast
          key={toastItem.id}
          variant={toastItem.variant ?? 'default'}
          duration={toastItem.duration ?? 5000}
          onOpenChange={(open) => {
            if (!open) {
              dismiss(toastItem.id);
            }
          }}
        >
          <div className="grid gap-1">
            {toastItem.title ? <ToastTitle>{toastItem.title}</ToastTitle> : null}
            {toastItem.description ? (
              <ToastDescription>{toastItem.description}</ToastDescription>
            ) : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
