'use client';

import { Fragment, useCallback, useState } from 'react';

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
  EyeOffIcon,
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

type ValidationResult = {
  success: boolean;
  error?: {
    issues: Array<{ message: string }>;
  };
};

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

  const showSecretVars = searchParams.get('secret') === 'true';
  const showPublicVars = searchParams.get('public') === 'true';
  const showPrivateVars = searchParams.get('private') === 'true';
  const showOverriddenVars = searchParams.get('overridden') === 'true';
  const showInvalidVars = searchParams.get('invalid') === 'true';

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

  const allVariables = getEffectiveVariablesValue(appState);

  // Create a map of all variables including missing ones that have contextual validation
  const allVarsWithValidation = envVariables.reduce<
    Record<string, EnvVariableState>
  >((acc, model) => {
    // If the variable exists in appState, use that
    const existingVar = appState.variables[model.name];
    if (existingVar) {
      acc[model.name] = existingVar;
    } else if (
      // Show missing variables if they:
      model.required || // Are marked as required
      model.contextualValidation // OR have contextual validation
    ) {
      // If it doesn't exist but is required or has contextual validation, create an empty state
      acc[model.name] = {
        key: model.name,
        effectiveValue: '',
        effectiveSource: 'MISSING',
        category: model.category,
        isOverridden: false,
        definitions: [],
      };
    }
    return acc;
  }, {});

  const renderVariable = (varState: EnvVariableState) => {
    const isExpanded = expandedVars[varState.key] ?? false;
    const isClientBundledValue = varState.key.startsWith('NEXT_PUBLIC_');
    const isValueVisible = showValues[varState.key] ?? isClientBundledValue;

    const model = envVariables.find(
      (variable) => variable.name === varState.key,
    );

    // Enhanced validation logic to handle both regular and contextual validation
    let validation: ValidationResult = {
      success: true,
    };

    if (model) {
      // First check if it's required but missing
      if (model.required && !varState.effectiveValue) {
        validation = {
          success: false,
          error: {
            issues: [
              {
                message: `This variable is required but missing from your environment files`,
              },
            ],
          },
        };
      } else if (model.contextualValidation) {
        // Then check contextual validation
        const dependenciesMet = model.contextualValidation.dependencies.some(
          (dep) => {
            const dependencyValue = allVariables[dep.variable] ?? '';

            return dep.condition(dependencyValue, allVariables);
          },
        );

        if (dependenciesMet) {
          // Only check for missing value or run validation if dependencies are met
          if (!varState.effectiveValue) {
            const dependencyErrors = model.contextualValidation.dependencies
              .map((dep) => {
                const dependencyValue = allVariables[dep.variable] ?? '';

                const shouldValidate = dep.condition(
                  dependencyValue,
                  allVariables,
                );

                if (shouldValidate) {
                  const { success } = model.contextualValidation!.validate({
                    value: varState.effectiveValue,
                    variables: allVariables,
                    mode: appState.mode,
                  });

                  if (success) {
                    return null;
                  }

                  return dep.message;
                }

                return null;
              })
              .filter((message): message is string => message !== null);

            validation = {
              success: dependencyErrors.length === 0,
              error: {
                issues: dependencyErrors.map((message) => ({ message })),
              },
            };
          } else {
            // If we have a value and dependencies are met, run contextual validation
            const result = model.contextualValidation.validate({
              value: varState.effectiveValue,
              variables: allVariables,
              mode: appState.mode,
            });

            if (!result.success) {
              validation = {
                success: false,
                error: {
                  issues: result.error.issues.map((issue) => ({
                    message: issue.message,
                  })),
                },
              };
            }
          }
        }
      } else if (model.validate && varState.effectiveValue) {
        // Only run regular validation if:
        // 1. There's no contextual validation
        // 2. There's a value to validate
        const result = model.validate({
          value: varState.effectiveValue,
          variables: allVariables,
          mode: appState.mode,
        });

        if (!result.success) {
          validation = {
            success: false,
            error: {
              issues: result.error.issues.map((issue) => ({
                message: issue.message,
              })),
            },
          };
        }
      }
    }

    const canExpand = varState.definitions.length > 1 || !validation.success;

    return (
      <div key={varState.key} className="animate-in fade-in rounded-lg border">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 flex-col gap-y-4">
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm font-semibold">
                  {varState.key}
                </span>

                {model?.required && <Badge variant="outline">Required</Badge>}

                {varState.effectiveSource === 'MISSING' && (
                  <Badge
                    variant={
                      // Show destructive if required OR if contextual validation dependencies are not met
                      model?.required ||
                      model?.contextualValidation?.dependencies.some((dep) => {
                        const dependencyValue =
                          allVariables[dep.variable] ?? '';

                        const shouldValidate = dep.condition(
                          dependencyValue,
                          allVariables,
                        );

                        if (!shouldValidate) {
                          return false;
                        }

                        return !model.contextualValidation!.validate({
                          value: varState.effectiveValue,
                          variables: allVariables,
                          mode: appState.mode,
                        }).success;
                      })
                        ? 'destructive'
                        : 'outline'
                    }
                  >
                    Missing
                  </Badge>
                )}

                {varState.isOverridden && (
                  <Badge variant="warning">Overridden</Badge>
                )}
              </div>

              <If condition={model}>
                {(model) => (
                  <div className="flex items-center gap-2 py-1">
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

            <If condition={varState.effectiveSource !== 'MISSING'}>
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
            </If>

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
                  <AlertTitle>
                    {varState.effectiveSource === 'MISSING'
                      ? 'Missing Required Variable'
                      : 'Invalid Value'}
                  </AlertTitle>

                  <AlertDescription>
                    <div className="space-y-2">
                      <div>
                        {varState.effectiveSource === 'MISSING'
                          ? `The variable ${varState.key} is required but missing from your environment files:`
                          : `The value for ${varState.key} is invalid:`}
                      </div>

                      {/* Enhanced error display */}
                      <div className="space-y-1">
                        {validation.error?.issues.map((issue, index) => (
                          <div key={index} className="text-sm">
                            • {issue.message}
                          </div>
                        ))}
                      </div>

                      {/* Display dependency information if available */}
                      {model?.contextualValidation?.dependencies && (
                        <div className="mt-4 space-y-1">
                          <div className="font-medium">Dependencies:</div>

                          {model.contextualValidation.dependencies.map(
                            (dep, index) => (
                              <div key={index} className="text-sm">
                                • Requires valid {dep.variable.toUpperCase()}{' '}
                                when {dep.message}
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
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
      !showSecretVars &&
      !showPublicVars &&
      !showPrivateVars &&
      !showInvalidVars &&
      !showOverriddenVars
    ) {
      return true;
    }

    const isSecret = model?.secret ?? false;
    const isPublic = varState.key.startsWith('NEXT_PUBLIC_');
    const isPrivate = !isPublic;

    const isInSearch = search
      ? varState.key.toLowerCase().includes(search.toLowerCase())
      : true;

    if (showPublicVars && isInSearch) {
      return isPublic;
    }

    if (showSecretVars && isInSearch) {
      return isSecret;
    }

    if (showPrivateVars && isInSearch) {
      return isPrivate;
    }

    if (showOverriddenVars && isInSearch) {
      return varState.isOverridden;
    }

    if (showInvalidVars) {
      const allVariables = getEffectiveVariablesValue(appState);

      let hasError = false;

      if (model) {
        if (model.contextualValidation) {
          // Check for missing or invalid dependencies
          const dependencyErrors = model.contextualValidation.dependencies
            .map((dep) => {
              const dependencyValue = allVariables[dep.variable] ?? '';

              const shouldValidate = dep.condition(
                dependencyValue,
                allVariables,
              );

              if (shouldValidate) {
                const { error } = model.contextualValidation!.validate({
                  value: varState.effectiveValue,
                  variables: allVariables,
                  mode: appState.mode,
                });

                return error;
              }

              return false;
            })
            .filter(Boolean);

          if (dependencyErrors.length > 0) {
            hasError = true;
          }
        } else if (model.validate) {
          // Fall back to regular validation
          const result = model.validate({
            value: varState.effectiveValue,
            variables: allVariables,
            mode: appState.mode,
          });

          hasError = !result.success;
        }
      }

      return hasError && isInSearch;
    }

    return isInSearch;
  };

  // Update groups to use allVarsWithValidation instead of appState.variables
  const groups = Object.values(allVarsWithValidation)
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
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center">
        <div className="flex w-full space-x-2">
          <div>
            <EnvModeSelector mode={appState.mode} />
          </div>

          <div>
            <FilterSwitcher
              filters={{
                secret: showSecretVars,
                public: showPublicVars,
                overridden: showOverriddenVars,
                private: showPrivateVars,
                invalid: showInvalidVars,
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

      <div className="flex flex-col">
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
  const secretVars = props.filters.secret;
  const publicVars = props.filters.public;
  const overriddenVars = props.filters.overridden;
  const privateVars = props.filters.private;
  const invalidVars = props.filters.invalid;

  const handleFilterChange = useUpdateFilteredVariables();

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
  const allVariables = getEffectiveVariablesValue(appState);
  const overridden = varsArray.filter((variable) => variable.isOverridden);
  const handleFilterChange = useUpdateFilteredVariables();

  // Find all variables with errors (including missing required and contextual validation)
  const errors = envVariables.reduce<string[]>((acc, model) => {
    // Get the current value of this variable
    const varState = appState.variables[model.name];
    const value = varState?.effectiveValue;
    let hasError = false;

    // Check if it's required but missing
    if (model.required && !value) {
      hasError = true;
    } else if (model.contextualValidation) {
      // Check if any dependency conditions are met
      const dependenciesErrors = model.contextualValidation.dependencies.some(
        (dep) => {
          const dependencyValue = allVariables[dep.variable] ?? '';

          const shouldValidate = dep.condition(dependencyValue, allVariables);

          if (shouldValidate) {
            const { error } = model.contextualValidation!.validate({
              value: varState?.effectiveValue ?? '',
              variables: allVariables,
              mode: appState.mode,
            });

            return error;
          }
        },
      );

      if (dependenciesErrors) {
        hasError = true;
      }
    } else if (model.validate && value) {
      // Only run regular validation if:
      // 1. There's no contextual validation
      // 2. There's a value to validate
      const result = model.validate({
        value,
        variables: allVariables,
        mode: appState.mode,
      });

      if (!result.success) {
        hasError = true;
      }
    }

    if (hasError) {
      acc.push(model.name);
    }

    return acc;
  }, []);

  const validVariables = varsArray.length - errors.length;

  return (
    <div className="flex justify-between space-x-4">
      <div className="flex items-center gap-x-2">
        <Badge variant={'outline'} className={'text-green-500'}>
          {validVariables} Valid
        </Badge>

        <Badge
          variant={'outline'}
          className={cn({
            'text-destructive': errors.length > 0,
            'text-green-500': errors.length === 0,
          })}
        >
          {errors.length} Invalid
        </Badge>

        <If condition={overridden.length > 0}>
          <Badge
            variant={'outline'}
            className={cn({ 'text-orange-500': overridden.length > 0 })}
          >
            {overridden.length} Overridden
          </Badge>
        </If>
      </div>

      <div>
        <If condition={errors.length > 0}>
          <Button
            size={'sm'}
            variant={'ghost'}
            onClick={() => handleFilterChange('invalid', true, true)}
          >
            <EyeOffIcon className="mr-2 h-3 w-3" />
            Display Invalid only
          </Button>
        </If>
      </div>
    </div>
  );
}

function getEffectiveVariablesValue(
  appState: AppEnvState,
): Record<string, string> {
  const varsArray = Object.values(appState.variables);

  return varsArray.reduce(
    (acc, variable) => ({
      ...acc,
      [variable.key]: variable.effectiveValue,
    }),
    {},
  );
}

function useUpdateFilteredVariables() {
  const router = useRouter();

  const handleFilterChange = (key: string, value: boolean, reset = false) => {
    const searchParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    const resetAll = () => {
      searchParams.delete('secret');
      searchParams.delete('public');
      searchParams.delete('overridden');
      searchParams.delete('private');
      searchParams.delete('invalid');
    };

    if (reset) {
      resetAll();
    }

    if (key === 'all' && value) {
      resetAll();
    } else {
      if (!value) {
        searchParams.delete(key);
      } else {
        searchParams.set(key, 'true');
      }
    }

    router.push(`${path}?${searchParams.toString()}`);
  };

  return useCallback(handleFilterChange, [router]);
}
