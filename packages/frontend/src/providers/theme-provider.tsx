'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';
import type * as React from 'react';

export function ThemeProvider({ children, ...props }: ThemeProviderProps): React.ReactNode {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
