import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-brand-teal/25 bg-brand-teal/10 text-brand-teal',
        secondary: 'border-white/12 bg-white/6 text-slate-400',
        destructive: 'border-red-500/25 bg-red-500/10 text-red-400',
        success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
        warning: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
        outline: 'border-white/15 bg-transparent text-slate-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
