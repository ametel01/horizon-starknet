import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | undefined;
  hint?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftElement, rightElement, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-neutral-300">
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leftElement !== undefined ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftElement}
            </div>
          ) : null}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-neutral-100',
              'placeholder:text-neutral-500',
              'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error !== undefined && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              leftElement !== undefined && 'pl-10',
              rightElement !== undefined && 'pr-20',
              className
            )}
            {...props}
          />
          {rightElement !== undefined ? (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightElement}</div>
          ) : null}
        </div>
        {error ? <p className="mt-1.5 text-sm text-red-500">{error}</p> : null}
        {hint && !error ? <p className="mt-1.5 text-sm text-neutral-500">{hint}</p> : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface NumberInputProps extends Omit<InputProps, 'type' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, decimals = 18, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const inputValue = e.target.value;

      // Allow empty string
      if (inputValue === '') {
        onChange('');
        return;
      }

      // Validate number format with optional decimals
      const regex = new RegExp(`^\\d*\\.?\\d{0,${String(decimals)}}$`);
      if (regex.test(inputValue)) {
        onChange(inputValue);
      }
    };

    return (
      <Input
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
