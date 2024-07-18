import Image from 'next/image';
import Link from 'next/link';

import {
  ArrowRightIcon,
  CreditCard,
  LayoutDashboard,
  Lock,
  Sparkle,
} from 'lucide-react';

import { PricingTable } from '@kit/billing-gateway/marketing';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';
import { cn } from '@kit/ui/utils';

import billingConfig from '~/config/billing.config';
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

function Home() {
  return (
    <div className={'mt-4 flex flex-col space-y-24 py-14'}>
      <div className={'container mx-auto flex flex-col space-y-20'}>
        <div
          className={
            'flex flex-col items-center md:flex-row' +
            ' mx-auto flex-1 justify-center animate-in fade-in' +
            ' duration-500 zoom-in-95 slide-in-from-top-24'
          }
        >
          <div
            className={
              'flex w-full flex-1 flex-col items-center space-y-6 xl:space-y-8 2xl:space-y-10'
            }
          >
            <Pill>
              <span>The leading SaaS Starter Kit for ambitious developers</span>
            </Pill>

            <div className={'flex flex-col items-center space-y-8'}>
              <HeroTitle>
                <span>The ultimate SaaS Starter</span>

                <span>for your next project</span>
              </HeroTitle>

              <div className={'flex max-w-2xl flex-col space-y-1'}>
                <Heading
                  level={3}
                  className={
                    'p-0 text-center font-sans font-normal text-muted-foreground'
                  }
                >
                  Build and Ship a SaaS faster than ever before with the
                  next-gen SaaS Starter Kit. Ship your SaaS in days, not months.
                </Heading>
              </div>
            </div>

            <MainCallToActionButton />
          </div>
        </div>

        <div
          className={
            'mx-auto flex max-w-6xl justify-center py-12 animate-in fade-in ' +
            ' delay-300 duration-1000 slide-in-from-top-16 fill-mode-both'
          }
        >
          <Image
            priority
            className={
              'delay-250 rounded-lg border duration-1000 ease-out animate-in fade-in zoom-in-50 fill-mode-both'
            }
            width={1689}
            height={1057}
            src={`/images/dashboard-demo.webp`}
            alt={`App Image`}
          />
        </div>
      </div>

      <div className={'container mx-auto'}>
        <div
          className={'flex flex-col space-y-16 xl:space-y-32 2xl:space-y-36'}
        >
          <FeatureShowcaseContainer>
            <FeatureContainer>
              <div className={'flex flex-col space-y-4'}>
                <IconContainer className={'border'}>
                  <Lock className={'h-5'} />
                </IconContainer>

                <div className={'flex flex-col'}>
                  <Heading level={2}>Authentication</Heading>

                  <Heading
                    level={3}
                    className={
                      'font-sans font-normal tracking-normal text-muted-foreground'
                    }
                  >
                    Secure and Easy-to-Use Authentication for Your SaaS Website
                    and API
                  </Heading>
                </div>
              </div>

              <p className={'text-muted-foreground'}>
                Our authentication system is built on top of the
                industry-leading PaaS such as Supabase and Firebase. It is
                secure, easy-to-use, and fully customizable. It supports
                email/password, social logins, and more.
              </p>
            </FeatureContainer>

            <FeatureContainer>
              <Image
                className="rounded-2xl"
                src={'/images/sign-in.webp'}
                width={'1760'}
                height={'1680'}
                alt={'Sign In'}
              />
            </FeatureContainer>
          </FeatureShowcaseContainer>

          <FeatureShowcaseContainer>
            <FeatureContainer reverse>
              <Image
                className="rounded-2xl"
                src={'/images/dashboard.webp'}
                width={'2004'}
                height={'1410'}
                alt={'Dashboard'}
              />
            </FeatureContainer>

            <FeatureContainer>
              <div className={'flex flex-col space-y-4'}>
                <IconContainer className={'border'}>
                  <LayoutDashboard className={'h-5'} />
                </IconContainer>

                <div className={'flex flex-col'}>
                  <Heading level={2}>Dashboard</Heading>

                  <Heading
                    level={3}
                    className={
                      'font-sans font-normal tracking-normal text-muted-foreground'
                    }
                  >
                    A fantastic dashboard to manage your SaaS business
                  </Heading>
                </div>
              </div>

              <p className={'text-muted-foreground'}>
                Our dashboard offers an overview of your SaaS business. It shows
                at a glance all you need to know about your business. It is
                fully customizable and extendable.
              </p>
            </FeatureContainer>
          </FeatureShowcaseContainer>

          <FeatureShowcaseContainer>
            <FeatureContainer>
              <div className={'flex flex-col space-y-4'}>
                <IconContainer className={'border'}>
                  <CreditCard className={'h-5'} />
                </IconContainer>

                <div className={'flex flex-col'}>
                  <Heading level={2}>Billing</Heading>

                  <Heading
                    level={3}
                    className={
                      'font-sans font-normal tracking-normal text-muted-foreground'
                    }
                  >
                    A powerful billing system for your SaaS business
                  </Heading>
                </div>
              </div>

              <p className={'text-muted-foreground'}>
                Powerful billing system that supports multiple payment gateways
                such as Stripe, Lemon Squeezy and Paddle. Fully customizable and
                easy to use.
              </p>
            </FeatureContainer>

            <FeatureContainer>
              <Image
                className="rounded-2xl"
                src={'/images/billing.webp'}
                width={'1916'}
                height={'1392'}
                alt={'Billing'}
              />
            </FeatureContainer>
          </FeatureShowcaseContainer>
        </div>
      </div>

      <div className={'container mx-auto'}>
        <div
          className={
            'flex flex-col items-center justify-center space-y-16 py-16'
          }
        >
          <div className={'flex flex-col items-center space-y-4 text-center'}>
            <Pill>Get started for free. No credit card required.</Pill>

            <div className={'flex flex-col'}>
              <Heading level={2}>
                Fair pricing for all types of businesses
              </Heading>

              <Heading
                level={3}
                className={'font-sans font-normal text-muted-foreground'}
              >
                Get started on our free plan and upgrade when you are ready.
              </Heading>
            </div>
          </div>

          <div className={'w-full'}>
            <PricingTable
              config={billingConfig}
              paths={{
                signUp: pathsConfig.auth.signUp,
                return: pathsConfig.app.home,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default withI18n(Home);

function HeroTitle({ children }: React.PropsWithChildren) {
  return (
    <h1
      className={
        'flex flex-col space-y-1 text-center font-sans text-4xl font-medium tracking-tight dark:text-white sm:text-6xl lg:max-w-5xl lg:text-7xl xl:text-[4.5rem]'
      }
    >
      {children}
    </h1>
  );
}

function Pill(props: React.PropsWithChildren) {
  return (
    <h2
      className={
        'rounded-full border border-gray-100 px-2.5 py-2 text-center text-sm font-medium dark:border-primary/10'
      }
    >
      <Sparkle className={'mr-2 inline-block h-4'} />
      {props.children}
    </h2>
  );
}

function FeatureShowcaseContainer(props: React.PropsWithChildren) {
  return (
    <div
      className={
        'flex flex-col items-center justify-between space-y-8 lg:flex-row lg:space-y-0' +
        ' lg:space-x-24'
      }
    >
      {props.children}
    </div>
  );
}

function FeatureContainer(
  props: React.PropsWithChildren<{
    className?: string;
    reverse?: boolean;
  }>,
) {
  return (
    <div
      className={cn('flex w-full flex-col space-y-6 lg:w-6/12', {
        'order-2 mt-8 lg:order-none lg:mt-0': props.reverse,
      })}
    >
      {props.children}
    </div>
  );
}

function MainCallToActionButton() {
  return (
    <div className={'flex space-x-4'}>
      <Button
        className={'h-12 rounded-xl px-4 text-base font-semibold'}
        asChild
      >
        <Link href={'/auth/sign-up'}>
          <span className={'flex items-center space-x-0.5'}>
            <span>
              <Trans i18nKey={'common:getStarted'} />
            </span>

            <ArrowRightIcon
              className={
                'h-4 animate-in fade-in slide-in-from-left-8' +
                ' delay-800 duration-1000 zoom-in fill-mode-both'
              }
            />
          </span>
        </Link>
      </Button>

      <Button
        variant={'link'}
        className={'h-12 rounded-xl px-4 text-base font-semibold'}
        asChild
      >
        <Link href={'/contact'}>
          <Trans i18nKey={'common:contactUs'} />
        </Link>
      </Button>
    </div>
  );
}

function IconContainer(
  props: React.PropsWithChildren<{
    className?: string;
  }>,
) {
  return (
    <div className={'flex'}>
      <span
        className={cn(
          'flex items-center justify-center rounded-lg p-3',
          props.className,
        )}
      >
        {props.children}
      </span>
    </div>
  );
}
