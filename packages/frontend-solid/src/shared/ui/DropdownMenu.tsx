import { DropdownMenu as DropdownMenuPrimitive } from '@kobalte/core/dropdown-menu';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, splitProps } from 'solid-js';

/** Inline SVG Check icon */
function CheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Inline SVG ChevronRight icon */
function ChevronRightIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

type DropdownMenuRootProps = ComponentProps<typeof DropdownMenuPrimitive>;

function DropdownMenu(props: DropdownMenuRootProps): JSX.Element {
  return <DropdownMenuPrimitive data-slot="dropdown-menu" {...props} />;
}

type DropdownMenuTriggerProps = ComponentProps<typeof DropdownMenuPrimitive.Trigger>;

function DropdownMenuTrigger(props: DropdownMenuTriggerProps): JSX.Element {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

type DropdownMenuPortalProps = ComponentProps<typeof DropdownMenuPrimitive.Portal>;

function DropdownMenuPortal(props: DropdownMenuPortalProps): JSX.Element {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

type DropdownMenuContentProps = ComponentProps<typeof DropdownMenuPrimitive.Content>;

function DropdownMenuContent(props: DropdownMenuContentProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        class={cn(
          'data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 ring-foreground/5 bg-popover text-popover-foreground z-50 min-w-48 overflow-hidden rounded-2xl p-1 shadow-2xl ring-1 duration-100 outline-none',
          local.class
        )}
        {...others}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

type DropdownMenuGroupProps = ComponentProps<typeof DropdownMenuPrimitive.Group>;

function DropdownMenuGroup(props: DropdownMenuGroupProps): JSX.Element {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

type DropdownMenuGroupLabelProps = ComponentProps<typeof DropdownMenuPrimitive.GroupLabel> & {
  inset?: boolean;
};

function DropdownMenuLabel(props: DropdownMenuGroupLabelProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'inset']);

  return (
    <DropdownMenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={local.inset}
      class={cn('text-muted-foreground px-3 py-2.5 text-xs data-[inset]:pl-8', local.class)}
      {...others}
    />
  );
}

type DropdownMenuItemProps = ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
};

function DropdownMenuItem(props: DropdownMenuItemProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'inset', 'variant']);
  const variant = () => local.variant ?? 'default';

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={local.inset}
      data-variant={variant()}
      class={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive not-data-[variant=destructive]:focus:**:text-accent-foreground group/dropdown-menu-item relative flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class
      )}
      {...others}
    />
  );
}

type DropdownMenuSubProps = ComponentProps<typeof DropdownMenuPrimitive.Sub>;

function DropdownMenuSub(props: DropdownMenuSubProps): JSX.Element {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

type DropdownMenuSubTriggerProps = ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
};

function DropdownMenuSubTrigger(props: DropdownMenuSubTriggerProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'inset', 'children']);

  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={local.inset}
      class={cn(
        "focus:bg-accent focus:text-accent-foreground data-[expanded]:bg-accent data-[expanded]:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground flex cursor-default items-center gap-2 rounded-xl px-3 py-2 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class
      )}
      {...others}
    >
      {local.children}
      <ChevronRightIcon class="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

type DropdownMenuSubContentProps = ComponentProps<typeof DropdownMenuPrimitive.SubContent>;

function DropdownMenuSubContent(props: DropdownMenuSubContentProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        class={cn(
          'data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 ring-foreground/5 bg-popover text-popover-foreground z-50 min-w-36 overflow-hidden rounded-2xl p-1 shadow-2xl ring-1 duration-100',
          local.class
        )}
        {...others}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

type DropdownMenuCheckboxItemProps = ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>;

function DropdownMenuCheckboxItem(props: DropdownMenuCheckboxItemProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      class={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground relative flex cursor-default items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class
      )}
      {...others}
    >
      <span
        class="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon class="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

type DropdownMenuRadioGroupProps = ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>;

function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps): JSX.Element {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

type DropdownMenuRadioItemProps = ComponentProps<typeof DropdownMenuPrimitive.RadioItem>;

function DropdownMenuRadioItem(props: DropdownMenuRadioItemProps): JSX.Element {
  const [local, others] = splitProps(props, ['class', 'children']);

  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      class={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground relative flex cursor-default items-center gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        local.class
      )}
      {...others}
    >
      <span
        class="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon class="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {local.children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

type DropdownMenuSeparatorProps = ComponentProps<typeof DropdownMenuPrimitive.Separator>;

function DropdownMenuSeparator(props: DropdownMenuSeparatorProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      class={cn('bg-border/50 -mx-1 my-1 h-px', local.class)}
      {...others}
    />
  );
}

type DropdownMenuShortcutProps = ComponentProps<'span'>;

function DropdownMenuShortcut(props: DropdownMenuShortcutProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <span
      data-slot="dropdown-menu-shortcut"
      class={cn(
        'text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground ml-auto text-xs tracking-widest',
        local.class
      )}
      {...others}
    />
  );
}

// Export Kobalte primitive for direct access
export { DropdownMenuPrimitive };

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};

export type {
  DropdownMenuRootProps,
  DropdownMenuTriggerProps,
  DropdownMenuPortalProps,
  DropdownMenuContentProps,
  DropdownMenuGroupProps,
  DropdownMenuGroupLabelProps,
  DropdownMenuItemProps,
  DropdownMenuSubProps,
  DropdownMenuSubTriggerProps,
  DropdownMenuSubContentProps,
  DropdownMenuCheckboxItemProps,
  DropdownMenuRadioGroupProps,
  DropdownMenuRadioItemProps,
  DropdownMenuSeparatorProps,
  DropdownMenuShortcutProps,
};
