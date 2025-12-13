'use client';

import { useCallback, useState } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
}

type ToastInput = Omit<ToastItem, 'id'>;

let toastCount = 0;

function generateId(): string {
  toastCount += 1;
  return `toast-${String(toastCount)}`;
}

// Global state for toasts (allows usage outside of React components)
let listeners: ((state: ToastState) => void)[] = [];
let memoryState: ToastState = { toasts: [] };

function dispatch(
  action: { type: 'ADD'; toast: ToastItem } | { type: 'REMOVE'; id: string }
): void {
  if (action.type === 'ADD') {
    memoryState = {
      toasts: [...memoryState.toasts, action.toast],
    };
  } else {
    memoryState = {
      toasts: memoryState.toasts.filter((t) => t.id !== action.id),
    };
  }

  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

export function toast(props: ToastInput): string {
  const id = generateId();
  dispatch({
    type: 'ADD',
    toast: {
      ...props,
      id,
      duration: props.duration ?? 5000,
    },
  });
  return id;
}

toast.success = (props: Omit<ToastInput, 'variant'>): string =>
  toast({ ...props, variant: 'success' });

toast.error = (props: Omit<ToastInput, 'variant'>): string => toast({ ...props, variant: 'error' });

toast.warning = (props: Omit<ToastInput, 'variant'>): string =>
  toast({ ...props, variant: 'warning' });

export function dismissToast(id: string): void {
  dispatch({ type: 'REMOVE', id });
}

export function useToast(): {
  toasts: ToastItem[];
  toast: typeof toast;
  dismiss: (id: string) => void;
} {
  const [state, setState] = useState<ToastState>(memoryState);

  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  // Subscribe to state changes
  useState(() => {
    const unsubscribe = subscribe(setState);
    return unsubscribe;
  });

  return {
    toasts: state.toasts,
    toast,
    dismiss: dismissToast,
  };
}
