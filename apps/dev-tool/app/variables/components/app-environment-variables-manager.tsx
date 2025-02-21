'use client';

import { Fragment, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { envVariables } from '@/app/variables/lib/env-variables-model';
import { EnvModeSelector } from '@/components/env-mode-selector';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDownIcon,
  Copy,
  Eye,
  EyeOff,
  InfoIcon,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Heading } from '@kit/ui/heading';
import { If } from '@kit/ui/if';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import { AppEnvState, EnvVariableState } from '../lib/types';

export function AppEnvironmentVariablesManager({
  state,
}: React.PropsWithChildren<{
  state: AppEnvState;
}>) {
  return (
    <div className="flex flex-1 flex-col gap-y-4">
      <Heading level={5}>Application: {state.appName}</Heading>

      <div className={'flex flex-col space-y-4'}>
        <EnvList appState={state} />
      </div>
    </div>
  );
}

function EnvList({ appState }: { appState: AppEnvState }) {
  const [expandedVars, setExpandedVars] = useState<Record<string, boolean>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const searchParams = useSearchParams();

  const secretVars = searchParams.get('secret') === 'true';
  const publicVars = searchParams.get('public') === 'true';
  const privateVars = searchParams.get('private') === 'true';
  const overriddenVars = searchParams.get('overridden') === 'true';
  const invalidVars = searchParams.get('invalid') === 'true';

  const toggleExpanded = (key: string) => {
    setExpandedVars((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleShowValue = (key: string) => {
    setShowValues((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderValue = (value: string, isVisible: boolean) => {
    if (!isVisible) {
      return '••••••••';
    }

    return value || '(empty)';
  };

  const renderVariable = (varState: EnvVariableState) => {
    const isExpanded = expandedVars[varState.key] ?? false;
    const isClientBundledValue = varState.key.startsWith('NEXT_PUBLIC_');

    // public variables are always visible
    const isValueVisible = showValues[varState.key] ?? isClientBundledValue;

    // grab model is it's a kit variable
    const model = envVariables.find(
      (variable) => variable.name === varState.key,
    );

    const allVariables = Object.values(appState.variables).reduce(
      (acc, variable) => ({
        ...acc,
        [variable.key]: variable.effectiveValue,
      }),
      {},
    );

    const validation = model?.validate
      ? model.validate({
          value: varState.effectiveValue,
          variables: allVariables,
          mode: appState.mode,
        })
      : {
          success: true,
          error: undefined,
        };

    const canExpand = varState.definitions.length > 1 || !validation.success;

    return (
      <div key={varState.key} className="animate-in fade-in rounded-lg border">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 flex-col gap-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">
                  {varState.key}
                </span>

                {varState.isOverridden && (
                  <Badge variant="warning">Overridden</Badge>
                )}
              </div>

              <If condition={model}>
                {(model) => (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-normal">
                      {model.description}
                    </span>
                  </div>
                )}
              </If>

              <div className="mt-2 flex items-center gap-2">
                <div className="bg-muted text-muted-foreground flex-1 rounded px-2 py-2 font-mono text-xs">
                  {renderValue(varState.effectiveValue, isValueVisible)}
                </div>

                <If condition={!isClientBundledValue}>
                  <Button
                    variant="ghost"
                    size={'icon'}
                    onClick={() => toggleShowValue(varState.key)}
                  >
                    {isValueVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </If>

                <Button
                  variant="ghost"
                  onClick={() => copyToClipboard(varState.effectiveValue)}
                  size={'icon'}
                >
                  <Copy size={16} />
                </Button>
              </div>
            </div>

            {canExpand && (
              <Button
                size={'icon'}
                variant="ghost"
                className="ml-4 rounded p-1 hover:bg-gray-100"
                onClick={() => toggleExpanded(varState.key)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          <div className="mt-2 flex gap-x-2">
            <Badge
              variant="outline"
              className={cn({
                'text-orange-500': !isClientBundledValue,
                'text-green-500': isClientBundledValue,
              })}
            >
              {isClientBundledValue ? `Public variable` : `Private variable`}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="ml-2 h-3 w-3" />
                  </TooltipTrigger>

                  <TooltipContent>
                    {isClientBundledValue
                      ? `This variable will be bundled into the client side. If this is a private variable, do not use "NEXT_PUBLIC".`
                      : `This variable is private and will not be bundled client side, so you cannot access it from React components rendered client side`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Badge>

            <If condition={model?.secret}>
              <Badge variant="outline" className={'text-destructive'}>
                Secret Variable
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="ml-2 h-3 w-3" />
                    </TooltipTrigger>

                    <TooltipContent>
                      This is a secret key. Keep it safe!
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Badge>
            </If>

            <Badge
              variant={'outline'}
              className={cn({
                'text-destructive':
                  varState.effectiveSource === '.env.production',
              })}
            >
              {varState.effectiveSource}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="ml-2 h-3 w-3" />
                  </TooltipTrigger>

                  <TooltipContent>
                    {varState.effectiveSource === '.env.local'
                      ? `These variables are specific to this machine and are not committed`
                      : varState.effectiveSource === '.env.development'
                        ? `These variables are only being used during development`
                        : varState.effectiveSource === '.env'
                          ? `These variables are shared under all modes`
                          : `These variables are only used in production mode`}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Badge>

            <If condition={varState.isOverridden}>
              <Badge variant="warning">
                Overridden in {varState.effectiveSource}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="ml-2 h-3 w-3" />
                    </TooltipTrigger>

                    <TooltipContent>
                      This variable was overridden by a variable in{' '}
                      {varState.effectiveSource}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Badge>
            </If>

            <If condition={!validation.success}>
              <Badge variant="destructive">
                Invalid Value
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <InfoIcon className="ml-2 h-3 w-3" />
                    </TooltipTrigger>

                    <TooltipContent>
                      This variable has an invalid value. Drop down to view the
                      errors.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Badge>
            </If>
          </div>
        </div>

        {isExpanded && canExpand && (
          <div className="flex flex-col gap-y-2 border-t bg-gray-50 p-4">
            <If condition={!validation.success}>
              <div className={'flex flex-col space-y-2'}>
                <Heading level={6} className="Errors">
                  Errors
                </Heading>

                <Alert variant="destructive">
                  <AlertTitle>Invalid Value</AlertTitle>

                  <AlertDescription>
                    The value for {varState.key} is invalid:
                    <pre>
                      <code>{JSON.stringify(validation, null, 2)}</code>
                    </pre>
                  </AlertDescription>
                </Alert>
              </div>
            </If>

            <If condition={varState.definitions.length > 1}>
              <div className={'flex flex-col space-y-2'}>
                <Heading level={6} className="text-sm font-medium">
                  Override Chain
                </Heading>

                <div className="space-y-2">
                  {varState.definitions.map((def) => (
                    <div
                      key={`${def.key}-${def.source}`}
                      className="flex items-center gap-2"
                    >
                      <Badge
                        variant={'outline'}
                        className={cn({
                          'text-destructive': def.source === '.env.production',
                        })}
                      >
                        {def.source}
                      </Badge>

                      <div className="font-mono text-sm">
                        {renderValue(def.value, isValueVisible)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </If>
          </div>
        )}
      </div>
    );
  };

  const filterVariable = (varState: EnvVariableState) => {
    const model = envVariables.find(
      (variable) => variable.name === varState.key,
    );

    if (
      !search &&
      !secretVars &&
      !publicVars &&
      !privateVars &&
      !invalidVars &&
      !overriddenVars
    ) {
      return true;
    }

    const isSecret = model?.secret;
    const isPublic = varState.key.startsWith('NEXT_PUBLIC_');
    const isPrivate = !isPublic;

    const isInSearch = search
      ? varState.key.toLowerCase().includes(search.toLowerCase())
      : true;

    if (isPublic && publicVars && isInSearch) {
      return true;
    }

    if (isSecret && secretVars && isInSearch) {
      return true;
    }

    if (isPrivate && privateVars && isInSearch) {
      return true;
    }

    if (overriddenVars && varState.isOverridden && isInSearch) {
      return true;
    }

    if (invalidVars) {
      const allVariables = Object.values(appState.variables).reduce(
        (acc, variable) => ({
          ...acc,
          [variable.key]: variable.effectiveValue,
        }),
        {},
      );

      const hasError =
        model && model.validate
          ? !model.validate({
              value: varState.effectiveValue,
              variables: allVariables,
              mode: appState.mode,
            }).success
          : false;

      if (hasError && isInSearch) return true;
    }

    return false;
  };

  const groups = Object.values(appState.variables)
    .filter(filterVariable)
    .reduce(
      (acc, variable) => {
        const group = acc.find((group) => group.category === variable.category);

        if (!group) {
          acc.push({
            category: variable.category,
            variables: [variable],
          });
        } else {
          group.variables.push(variable);
        }

        return acc;
      },
      [] as Array<{ category: string; variables: Array<EnvVariableState> }>,
    );

  return (
    <div className="flex flex-col gap-y-8">
      <div className="flex items-center">
        <div className="flex w-full space-x-2">
          <div>
            <EnvModeSelector mode={appState.mode} />
          </div>

          <div>
            <FilterSwitcher
              filters={{
                secret: secretVars,
                public: publicVars,
                overridden: overriddenVars,
                private: privateVars,
                invalid: invalidVars,
              }}
            />
          </div>

          <Input
            className={'w-full'}
            placeholder="Search variables"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const report = createReportFromEnvState(appState);
                    const promise = copyToClipboard(report);

                    toast.promise(promise, {
                      loading: 'Copying report...',
                      success:
                        'Report copied to clipboard. Please paste it in your ticket.',
                      error: 'Failed to copy report to clipboard',
                    });
                  }}
                >
                  Copy to Clipboard
                </Button>
              </TooltipTrigger>

              <TooltipContent>
                Create a report from the environment variables. Useful for
                creating support tickets.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Summary appState={appState} />

        {groups.map((group) => (
          <div
            key={group.category}
            className="flex flex-col gap-y-2.5 border-b border-dashed py-8 last:border-b-0"
          >
            <div>
              <span className={'text-sm font-bold uppercase'}>
                {group.category}
              </span>
            </div>

            <div className="flex flex-col space-y-4">
              {group.variables.map((item) => {
                return (
                  <Fragment key={item.key}>{renderVariable(item)}</Fragment>
                );
              })}
            </div>
          </div>
        ))}

        <If condition={groups.length === 0}>
          <div className="flex h-full flex-1 flex-col items-center justify-center gap-y-4 py-16">
            <div className="text-muted-foreground text-sm">
              No variables found
            </div>
          </div>
        </If>
      </div>
    </div>
  );
}

function createReportFromEnvState(state: AppEnvState) {
  let report = ``;

  for (const key in state.variables) {
    const variable = state.variables[key];

    const variableReport = `${key}: ${JSON.stringify(variable, null, 2)}`;
    ``;

    report += variableReport + '\n';
  }

  return report;
}

function FilterSwitcher(props: {
  filters: {
    secret: boolean;
    public: boolean;
    overridden: boolean;
    private: boolean;
    invalid: boolean;
  };
}) {
  const router = useRouter();

  const secretVars = props.filters.secret;
  const publicVars = props.filters.public;
  const overriddenVars = props.filters.overridden;
  const privateVars = props.filters.private;
  const invalidVars = props.filters.invalid;

  const handleFilterChange = (key: string, value: boolean) => {
    const searchParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (key === 'all' && value) {
      searchParams.delete('secret');
      searchParams.delete('public');
      searchParams.delete('overridden');
      searchParams.delete('private');
      searchParams.delete('invalid');
    } else {
      if (!value) {
        searchParams.delete(key);
      } else {
        searchParams.set(key, 'true');
      }
    }

    router.push(`${path}?${searchParams.toString()}`);
  };

  const buttonLabel = () => {
    const filters = [];

    if (secretVars) filters.push('Secret');
    if (publicVars) filters.push('Public');
    if (overriddenVars) filters.push('Overridden');
    if (privateVars) filters.push('Private');
    if (invalidVars) filters.push('Invalid');

    if (filters.length === 0) return 'Filter variables';

    return filters.join(', ');
  };

  const allSelected =
    !secretVars && !publicVars && !overriddenVars && !invalidVars;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="font-normal">
          {buttonLabel()}

          <ChevronsUpDownIcon className="text-muted-foreground ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={() => {
            handleFilterChange('all', true);
          }}
        >
          All
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={secretVars}
          onCheckedChange={() => {
            handleFilterChange('secret', !secretVars);
          }}
        >
          Secret
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={privateVars}
          onCheckedChange={() => {
            handleFilterChange('private', !privateVars);
          }}
        >
          Private
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={publicVars}
          onCheckedChange={() => {
            handleFilterChange('public', !publicVars);
          }}
        >
          Public
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={invalidVars}
          onCheckedChange={() => {
            handleFilterChange('invalid', !invalidVars);
          }}
        >
          Invalid
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={overriddenVars}
          onCheckedChange={() => {
            handleFilterChange('overridden', !overriddenVars);
          }}
        >
          Overridden
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Summary({ appState }: { appState: AppEnvState }) {
  const varsArray = Object.values(appState.variables);
  const overridden = varsArray.filter((variable) => variable.isOverridden);

  const allVariables = varsArray.reduce(
    (acc, variable) => ({
      ...acc,
      [variable.key]: variable.effectiveValue,
    }),
    {},
  );

  const errors = varsArray.filter((variable) => {
    const model = envVariables.find((v) => variable.key === v.name);

    const validation =
      model && model.validate
        ? model.validate({
            value: variable.effectiveValue,
            variables: allVariables,
            mode: appState.mode,
          })
        : {
            success: true,
          };

    return !validation.success;
  });

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center gap-x-2">
        <Badge variant={errors.length === 0 ? 'success' : 'destructive'}>
          {errors.length} Errors
        </Badge>

        <Badge variant={overridden.length === 0 ? 'success' : 'warning'}>
          {overridden.length} Overridden Variables
        </Badge>
      </div>
    </div>
  );
}
