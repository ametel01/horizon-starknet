import { cn } from '@shared/lib/utils';
import { Label } from '@shared/ui/label';
import * as React from 'react';

/**
 * Input component with focus micro-interactions.
 *
 * Features:
 * - Smooth focus transitions with glow effect
 * - Ring animation on focus
 * - Hover state feedback
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        className={cn(
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
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

interface FormInputProps extends React.ComponentProps<'input'> {
  label?: string;
  error?: string;
  hint?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, label, error, hint, leftElement, rightElement, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <Label htmlFor={inputId} className="mb-1.5">
            {label}
          </Label>
        )}
        <div className="relative">
          {leftElement !== null && leftElement !== undefined && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftElement}
            </div>
          )}
          <Input
            id={inputId}
            ref={ref}
            className={cn(
              leftElement !== null && leftElement !== undefined && 'pl-10',
              rightElement !== null && rightElement !== undefined && 'pr-20',
              className
            )}
            aria-invalid={error !== undefined}
            {...props}
          />
          {rightElement !== null && rightElement !== undefined && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightElement}</div>
          )}
        </div>
        {error && <p className="text-destructive mt-1.5 text-sm">{error}</p>}
        {hint && !error && <p className="text-muted-foreground mt-1.5 text-sm">{hint}</p>}
      </div>
    );
  }
);
FormInput.displayName = 'FormInput';

interface NumberInputProps extends Omit<FormInputProps, 'type' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, decimals = 18, ...props }, ref) => {
    // Hoist RegExp creation to avoid allocation on every keystroke (js-hoist-regexp)
    const regex = React.useMemo(
      () => new RegExp(`^\\d*\\.?\\d{0,${String(decimals)}}$`),
      [decimals]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const inputValue = e.target.value;

      if (inputValue === '') {
        onChange('');
        return;
      }

      if (regex.test(inputValue)) {
        onChange(inputValue);
      }
    };

    return (
      <FormInput
        ref={ref}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
NumberInput.displayName = 'NumberInput';

export { Input, FormInput, NumberInput };
