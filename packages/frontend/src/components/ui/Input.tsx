import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        className={cn(
          'bg-input/30 border-input flex h-9 w-full rounded-lg border px-3 py-1 text-base transition-colors',
          'file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
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
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const inputValue = e.target.value;

      if (inputValue === '') {
        onChange('');
        return;
      }

      const regex = new RegExp(`^\\d*\\.?\\d{0,${String(decimals)}}$`);
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
