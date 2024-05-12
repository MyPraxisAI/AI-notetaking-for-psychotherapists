import * as React from 'react';

import { Slot, Slottable } from '@radix-ui/react-slot';
import { ChevronRight } from 'lucide-react';

import { cn } from '../utils';

export const CardButton = React.forwardRef<
  HTMLButtonElement,
  {
    asChild?: boolean;
    className?: string;
    children: React.ReactNode;
  }
>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      className={cn(
        'group relative flex h-36 rounded-lg bg-secondary/80 p-4 transition-all hover:bg-secondary/90 hover:shadow-sm active:bg-secondary active:shadow-lg',
        className,
      )}
      {...props}
    >
      <Slottable>{props.children}</Slottable>
    </Comp>
  );
});

export function CardButtonHeader(props: React.PropsWithChildren) {
  return (
    <>
      <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-secondary-foreground">
        {props.children}
      </span>

      <ChevronRight
        className={
          'absolute right-2 top-4 h-4 text-muted-foreground transition-colors group-hover:text-secondary-foreground'
        }
      />
    </>
  );
}
