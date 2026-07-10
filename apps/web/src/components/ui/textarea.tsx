import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-xl px-4 py-3 text-sm text-slate-100',
        'bg-white/[0.04] border transition-all duration-200 resize-none',
        'placeholder:text-slate-600',
        'focus:bg-white/[0.07] focus:outline-none focus:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error
          ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/15'
          : 'border-white/8 focus:border-brand-teal/50 focus:ring-brand-teal/15',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
