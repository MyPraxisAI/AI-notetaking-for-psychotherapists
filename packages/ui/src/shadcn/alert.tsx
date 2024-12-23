import * as React from 'react';

import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border bg-gradient-to-r px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 from-red-50 from-10% via-background to-background text-destructive dark:border-destructive dark:from-red-500/10 [&>svg]:text-destructive',
        success:
          'border-green-600/50 from-green-50 from-10% via-background to-background text-green-600 dark:border-green-600 dark:from-green-500/10 [&>svg]:text-green-600',
        warning:
          'border-orange-600/50 from-orange-50 from-10% via-background to-background text-orange-600 dark:border-orange-600 dark:from-orange-500/10 [&>svg]:text-orange-600',
        info: 'border-blue-600/50 from-blue-50 from-10% via-background to-background text-blue-600 dark:border-blue-600 dark:from-blue-500/10 [&>svg]:text-blue-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const Alert: React.FC<
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
> = ({ className, variant, ...props }) => (
  <div
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
);
Alert.displayName = 'Alert';

const AlertTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h5
    className={cn('mb-1 font-bold leading-none tracking-tight', className)}
    {...props}
  />
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className, ...props }) => (
  <div
    className={cn('text-sm font-normal [&_p]:leading-relaxed', className)}
    {...props}
  />
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
