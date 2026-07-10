import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl px-4 py-2 text-sm text-slate-100',
          'bg-white/5 border transition-all duration-200',
          'placeholder:text-slate-600',
          'focus:bg-white/8 focus:border-brand-teal/60 focus:ring-2 focus:ring-brand-teal/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20' : 'border-white/10',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
