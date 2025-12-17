# Light Mode Implementation Plan

## Overview

Implement theme switching (light/dark mode) for the Horizon frontend using shadcn semantic colors and the existing CSS variable system.

## Current State

- **Dark mode is hardcoded**: `className={cn('dark', ...)}` in `src/app/layout.tsx`
- **CSS variables exist for both modes**: `:root` (light) and `.dark` (dark) in `src/app/globals.css`
- **No theme context**: The existing `ModeToggle` is for UI complexity (simple/advanced), not theming
- **shadcn components.json**: Already configured with `cssVariables: true`

## Implementation Steps

### Step 1: Install next-themes

Install the `next-themes` package which is the recommended solution for Next.js theme switching and integrates seamlessly with shadcn.

```bash
bun add next-themes
```

### Step 2: Create Theme Provider

Create a theme provider component that wraps the app with next-themes.

**File**: `src/providers/theme-provider.tsx`

```tsx
'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

### Step 3: Create Theme Toggle Component

Create a new theme toggle component for the toolbar. This will be separate from the existing `ModeToggle` (UI complexity toggle).

**File**: `src/components/theme-toggle.tsx`

```tsx
'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 4: Update Providers Composition

Add `ThemeProvider` to the providers stack.

**File**: `src/providers/index.tsx`

Add ThemeProvider to the composition, wrapping at the outermost level:

```tsx
import { ThemeProvider } from './theme-provider';

// In the Providers component:
return (
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem
    disableTransitionOnChange
  >
    <QueryProvider>
      <StarknetProvider>
        <UIModeProvider>
          {children}
        </UIModeProvider>
      </StarknetProvider>
    </QueryProvider>
  </ThemeProvider>
);
```

### Step 5: Update Root Layout

Remove the hardcoded `dark` class and add `suppressHydrationWarning` for next-themes.

**File**: `src/app/layout.tsx`

Change:
```tsx
<html lang='en' className={cn('dark', publicSans.variable)}>
```

To:
```tsx
<html lang='en' className={publicSans.variable} suppressHydrationWarning>
```

### Step 6: Add Theme Toggle to Header

Add the `ThemeToggle` component to the header toolbar.

**File**: `src/components/layout/Header.tsx`

Import and add the component next to the existing ModeToggle:

```tsx
import { ThemeToggle } from '@/components/theme-toggle';

// In the header JSX, add before or after ModeToggle:
<ThemeToggle />
```

### Step 7: Review and Adjust CSS Variables (if needed)

The current CSS variables in `globals.css` already support both light and dark modes. Review the light mode colors to ensure they meet design requirements.

**File**: `src/app/globals.css`

Current light mode variables (`:root`):
- Background: `oklch(1 0 0)` (white)
- Foreground: `oklch(0.129 0.042 264.052)` (dark text)
- Primary: `oklch(0.646 0.222 41.116)` (golden)

If adjustments are needed, update the `:root` block with preferred light mode colors.

### Step 8: Test Theme Persistence

Verify that:
1. Theme preference persists across page reloads (stored in localStorage)
2. System preference detection works correctly
3. No flash of wrong theme on initial load
4. All components render correctly in both modes

## Component Checklist

After implementation, verify these components render correctly in both modes:

- [ ] Header/Navigation
- [ ] Footer
- [ ] Cards and containers
- [ ] Buttons (all variants)
- [ ] Form inputs
- [ ] Modals/Dialogs
- [ ] Tables
- [ ] Charts
- [ ] Toasts/Notifications
- [ ] Sidebar elements

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/providers/theme-provider.tsx` | Create | Theme provider wrapper |
| `src/components/theme-toggle.tsx` | Create | Theme toggle dropdown |
| `src/providers/index.tsx` | Modify | Add ThemeProvider to composition |
| `src/app/layout.tsx` | Modify | Remove hardcoded dark class |
| `src/components/layout/Header.tsx` | Modify | Add ThemeToggle to toolbar |
| `src/app/globals.css` | Review | Adjust light mode colors if needed |

## Dependencies

- `next-themes` - Theme management for Next.js

## Notes

- The existing `ModeToggle` component handles UI complexity (simple/advanced) - this is separate from theme switching
- Using `next-themes` is the shadcn-recommended approach for theme management
- The `attribute="class"` option ensures compatibility with Tailwind's dark mode
- Setting `defaultTheme="dark"` maintains current behavior as default
- `enableSystem` allows users to follow their OS preference
- `disableTransitionOnChange` prevents flash during theme switch
