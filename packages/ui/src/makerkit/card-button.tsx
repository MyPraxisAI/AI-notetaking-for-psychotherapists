import * as React from 'react';

import { Slot, Slottable } from '@radix-ui/react-slot';
import { ChevronRight } from 'lucide-react';

import { cn } from '../lib/utils';

export const CardButton: React.FC<
  {
    asChild?: boolean;
    className?: string;
    children: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
> = function CardButton({ className, asChild, ...props }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(
        'group relative flex h-36 flex-col rounded-lg border transition-all hover:bg-secondary/20 hover:shadow active:bg-secondary active:bg-secondary/50 active:shadow-lg dark:shadow-primary/20',
        className,
      )}
      {...props}
    >
      <Slottable>{props.children}</Slottable>
    </Comp>
  );
};

export const CardButtonTitle: React.FC<
  {
    asChild?: boolean;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLDivElement>
> = function CardButtonTitle({ className, asChild, ...props }) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn(
        className,
        'align-super text-sm font-medium text-muted-foreground transition-colors group-hover:text-secondary-foreground',
      )}
      {...props}
    >
      <Slottable>{props.children}</Slottable>
    </Comp>
  );
};

export const CardButtonHeader: React.FC<
  {
    children: React.ReactNode;
    asChild?: boolean;
    displayArrow?: boolean;
  } & React.HTMLAttributes<HTMLDivElement>
> = function CardButtonHeader({
  className,
  asChild,
  displayArrow = true,
  ...props
}) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp className={cn(className, 'p-4')} {...props}>
      <Slottable>
        {props.children}

        <ChevronRight
          className={cn(
            'absolute right-2 top-4 h-4 text-muted-foreground transition-colors group-hover:text-secondary-foreground',
            {
              hidden: !displayArrow,
            },
          )}
        />
      </Slottable>
    </Comp>
  );
};

export const CardButtonContent: React.FC<
  {
    asChild?: boolean;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLDivElement>
> = function CardButtonContent({ className, asChild, ...props }) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp className={cn(className, 'flex flex-1 flex-col px-4')} {...props}>
      <Slottable>{props.children}</Slottable>
    </Comp>
  );
};

export const CardButtonFooter: React.FC<
  {
    asChild?: boolean;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLDivElement>
> = function CardButtonFooter({ className, asChild, ...props }) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn(
        className,
        'mt-auto flex h-0 w-full flex-col justify-center border-t px-4',
      )}
      {...props}
    >
      <Slottable>{props.children}</Slottable>
    </Comp>
  );
};
