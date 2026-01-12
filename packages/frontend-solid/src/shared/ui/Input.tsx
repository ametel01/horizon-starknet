import { TextField } from '@kobalte/core/text-field';
import { cn } from '@shared/lib/utils';
import { type ComponentProps, type JSX, Show, splitProps } from 'solid-js';

type InputProps = Omit<ComponentProps<typeof TextField.Input>, 'class'> & {
  class?: string;
};

/**
 * Input component with focus micro-interactions.
 *
 * Features:
 * - Smooth focus transitions with glow effect
 * - Ring animation on focus
 * - Hover state feedback
 */
function Input(props: InputProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <TextField.Input
      data-slot="input"
      class={cn(
        // Base styles
        'bg-input/30 border-input flex h-9 w-full rounded-lg border px-3 py-1 text-base',
        // Micro-interactions: smooth transitions
        'transition-all duration-150 ease-out',
        // Hover state
        'hover:border-input/80 hover:bg-input/40',
        // File input styles
        'file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium',
        // Placeholder
        'placeholder:text-muted-foreground placeholder:transition-opacity focus:placeholder:opacity-70',
        // Focus state with glow effect
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        'focus-visible:bg-input/50',
        // Disabled state
        'disabled:hover:border-input disabled:hover:bg-input/30 disabled:cursor-not-allowed disabled:opacity-50',
        // Error state
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:focus-visible:ring-destructive/30',
        // Responsive text
        'md:text-sm',
        local.class
      )}
      {...others}
    />
  );
}

type TextFieldRootProps = ComponentProps<typeof TextField>;

/**
 * TextField root component that wraps Input with label and validation support.
 *
 * Uses Kobalte TextField primitive for accessibility.
 */
function TextFieldRoot(props: TextFieldRootProps): JSX.Element {
  return <TextField data-slot="text-field" {...props} />;
}

type TextFieldLabelProps = Omit<ComponentProps<typeof TextField.Label>, 'class'> & {
  class?: string;
};

function TextFieldLabel(props: TextFieldLabelProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <TextField.Label
      data-slot="text-field-label"
      class={cn(
        'text-foreground mb-1.5 block text-sm font-medium',
        local.class
      )}
      {...others}
    />
  );
}

type TextFieldDescriptionProps = Omit<ComponentProps<typeof TextField.Description>, 'class'> & {
  class?: string;
};

function TextFieldDescription(props: TextFieldDescriptionProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <TextField.Description
      data-slot="text-field-description"
      class={cn('text-muted-foreground mt-1.5 text-sm', local.class)}
      {...others}
    />
  );
}

type TextFieldErrorMessageProps = Omit<ComponentProps<typeof TextField.ErrorMessage>, 'class'> & {
  class?: string;
};

function TextFieldErrorMessage(props: TextFieldErrorMessageProps): JSX.Element {
  const [local, others] = splitProps(props, ['class']);

  return (
    <TextField.ErrorMessage
      data-slot="text-field-error"
      class={cn('text-destructive mt-1.5 text-sm', local.class)}
      {...others}
    />
  );
}

interface FormInputProps extends Omit<InputProps, 'id'> {
  /** Label text */
  label?: string;
  /** Error message (sets validation state to invalid) */
  error?: string;
  /** Hint text shown when no error */
  hint?: string;
  /** Element to show on the left side of input */
  leftElement?: JSX.Element;
  /** Element to show on the right side of input */
  rightElement?: JSX.Element;
  /** Input id (auto-generated from label if not provided) */
  id?: string;
  /** Input name for form submission */
  name?: string;
  /** Current value (controlled) */
  value?: string;
  /** Change handler */
  onValueChange?: (value: string) => void;
}

/**
 * Form input with label, error, hint, and optional left/right elements.
 */
function FormInput(props: FormInputProps): JSX.Element {
  const [local, others] = splitProps(props, [
    'label',
    'error',
    'hint',
    'leftElement',
    'rightElement',
    'id',
    'name',
    'class',
    'value',
    'onValueChange',
  ]);

  const inputId = () => local.id ?? local.label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <TextFieldRoot
      class="w-full"
      {...(local.name !== undefined && { name: local.name })}
      {...(local.value !== undefined && { value: local.value })}
      {...(local.onValueChange !== undefined && { onChange: local.onValueChange })}
      {...(local.error !== undefined && { validationState: 'invalid' as const })}
    >
      <Show when={local.label}>
        <TextFieldLabel for={inputId()}>{local.label}</TextFieldLabel>
      </Show>
      <div class="relative">
        <Show when={local.leftElement}>
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {local.leftElement}
          </div>
        </Show>
        <Input
          id={inputId()}
          class={cn(
            local.leftElement && 'pl-10',
            local.rightElement && 'pr-20',
            local.class
          )}
          {...others}
        />
        <Show when={local.rightElement}>
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            {local.rightElement}
          </div>
        </Show>
      </div>
      <Show when={local.error}>
        <TextFieldErrorMessage>{local.error}</TextFieldErrorMessage>
      </Show>
      <Show when={local.hint && !local.error}>
        <TextFieldDescription>{local.hint}</TextFieldDescription>
      </Show>
    </TextFieldRoot>
  );
}

interface NumberInputProps extends Omit<FormInputProps, 'type' | 'onValueChange' | 'inputMode'> {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Maximum decimal places allowed */
  decimals?: number;
}

/**
 * Number input with decimal validation.
 */
function NumberInput(props: NumberInputProps): JSX.Element {
  const [local, others] = splitProps(props, ['value', 'onChange', 'decimals']);

  const decimals = () => local.decimals ?? 18;

  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (e) => {
    const inputValue = e.currentTarget.value;

    if (inputValue === '') {
      local.onChange('');
      return;
    }

    const regex = new RegExp(`^\\d*\\.?\\d{0,${String(decimals())}}$`);
    if (regex.test(inputValue)) {
      local.onChange(inputValue);
    } else {
      // Reset to previous valid value
      e.currentTarget.value = local.value;
    }
  };

  return (
    <FormInput
      type="text"
      inputMode="decimal"
      value={local.value}
      onInput={handleInput}
      {...others}
    />
  );
}

// Export TextField namespace for direct access to Kobalte primitives
export { TextField };

// Export wrapper components
export {
  FormInput,
  Input,
  NumberInput,
  TextFieldDescription,
  TextFieldErrorMessage,
  TextFieldLabel,
  TextFieldRoot,
};

export type {
  FormInputProps,
  InputProps,
  NumberInputProps,
  TextFieldDescriptionProps,
  TextFieldErrorMessageProps,
  TextFieldLabelProps,
  TextFieldRootProps,
};
