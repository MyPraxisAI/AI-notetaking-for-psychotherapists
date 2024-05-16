'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '../shadcn/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '../shadcn/navigation-menu';
import { cn, isRouteActive } from '../utils';
import { Trans } from './trans';

export function BorderedNavigationMenu(props: React.PropsWithChildren) {
  return (
    <NavigationMenu className={'h-full'}>
      <NavigationMenuList className={'relative h-full space-x-2'}>
        {props.children}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export function BorderedNavigationMenuItem(props: {
  path: string;
  label: string;
  end?: boolean | ((path: string) => boolean);
  active?: boolean;
}) {
  const pathname = usePathname();

  const active = props.active ?? isRouteActive(props.path, pathname, props.end);

  return (
    <NavigationMenuItem>
      <Button asChild variant={'ghost'} className={'relative active:shadow-sm'}>
        <Link
          href={props.path}
          className={cn('text-sm', {
            'text-primary': active,
            'text-primary/80 hover:text-primary': !active,
          })}
        >
          <Trans i18nKey={props.label} defaults={props.label} />

          {active ? (
            <span
              className={cn(
                'absolute -bottom-2.5 left-0 h-0.5 w-full bg-primary animate-in fade-in zoom-in-90',
              )}
            />
          ) : null}
        </Link>
      </Button>
    </NavigationMenuItem>
  );
}
