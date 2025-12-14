'use client';

import { toast as sonnerToast } from 'sonner';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface ToastInput {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

function toast(props: ToastInput): string | number {
  const { title, description, variant = 'default', duration } = props;
  const message = title ?? description ?? '';
  const options = {
    description: title ? description : undefined,
    duration: duration ?? 5000,
  };

  switch (variant) {
    case 'success':
      return sonnerToast.success(message, options);
    case 'error':
      return sonnerToast.error(message, options);
    case 'warning':
      return sonnerToast.warning(message, options);
    default:
      return sonnerToast(message, options);
  }
}

toast.success = (props: Omit<ToastInput, 'variant'>): string | number =>
  toast({ ...props, variant: 'success' });

toast.error = (props: Omit<ToastInput, 'variant'>): string | number =>
  toast({ ...props, variant: 'error' });

toast.warning = (props: Omit<ToastInput, 'variant'>): string | number =>
  toast({ ...props, variant: 'warning' });

export function dismissToast(id: string | number): void {
  sonnerToast.dismiss(id);
}

export function useToast(): {
  toast: typeof toast;
  dismiss: (id: string | number) => void;
} {
  return {
    toast,
    dismiss: dismissToast,
  };
}

export { toast };
