import React, { forwardRef } from 'react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { CtaButton } from './cta-button';
import { GradientSecondaryText } from './gradient-secondary-text';
import { HeroTitle } from './hero-title';

const ComingSoonHeading = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <HeroTitle ref={ref} className={cn(className)} {...props} />
));
ComingSoonHeading.displayName = 'ComingSoonHeading';

const ComingSoonText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <GradientSecondaryText
    ref={ref}
    className={cn('text-lg text-muted-foreground md:text-xl', className)}
    {...props}
  />
));
ComingSoonText.displayName = 'ComingSoonText';

const ComingSoonButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ className, ...props }, ref) => (
  <CtaButton ref={ref} className={cn('mt-8', className)} {...props} />
));
ComingSoonButton.displayName = 'ComingSoonButton';

const ComingSoon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ children, className, ...props }, ref) => {
  const childrenArray = React.Children.toArray(children);

  const logo = childrenArray.find(
    (child) => React.isValidElement(child) && child.type === ComingSoonLogo,
  );

  const heading = childrenArray.find(
    (child) => React.isValidElement(child) && child.type === ComingSoonHeading,
  );

  const text = childrenArray.find(
    (child) => React.isValidElement(child) && child.type === ComingSoonText,
  );

  const button = childrenArray.find(
    (child) => React.isValidElement(child) && child.type === ComingSoonButton,
  );

  const cmps = [
    ComingSoonHeading,
    ComingSoonText,
    ComingSoonButton,
    ComingSoonLogo,
  ];

  const otherChildren = childrenArray.filter(
    (child) =>
      React.isValidElement(child) &&
      !cmps.includes(child.type as (typeof cmps)[number]),
  );

  return (
    <div
      ref={ref}
      className={cn(
        'container flex min-h-screen flex-col items-center justify-center space-y-12 p-4',
        className,
      )}
      {...props}
    >
      {logo}

      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center space-y-8 text-center">
        {heading}

        <div className={'mx-auto max-w-2xl'}>{text}</div>

        {button}

        {otherChildren}
      </div>
    </div>
  );
});
ComingSoon.displayName = 'ComingSoon';

const ComingSoonLogo = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLImageElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn(className, 'fixed left-8 top-8')} {...props} />
));
ComingSoonLogo.displayName = 'ComingSoonLogo';

export {
  ComingSoon,
  ComingSoonHeading,
  ComingSoonText,
  ComingSoonButton,
  ComingSoonLogo,
};
