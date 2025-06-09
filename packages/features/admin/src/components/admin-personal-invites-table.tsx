'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { zodResolver } from '@hookform/resolvers/zod';
import { ColumnDef } from '@tanstack/react-table';
import { EllipsisVertical, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { DataTable } from '@kit/ui/enhanced-data-table';
import { Form, FormControl, FormField, FormItem } from '@kit/ui/form';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { format as formatDate } from 'date-fns';
import {
  InviteStatus,
  PersonalInvite,
  revokePersonalInviteAction,
  resendPersonalInviteAction
} from '@kit/personal-invitations';

const FiltersSchema = z.object({
  status: z.enum(['all', 'pending', 'accepted', 'expired', 'revoked']),
  query: z.string().optional(),
});

export function AdminPersonalInvitesTable(
  props: React.PropsWithChildren<{
    data: PersonalInvite[];
    pageCount: number;
    pageSize: number;
    page: number;
    filters: {
      status: 'all' | InviteStatus;
      query: string;
    };
  }>,
) {
  return (
    <div className={'flex flex-col space-y-4'}>
      <div className={'flex justify-end'}>
        <PersonalInvitesTableFilters filters={props.filters} />
      </div>

      <DataTable
        pageSize={props.pageSize}
        pageIndex={props.page - 1}
        pageCount={props.pageCount}
        data={props.data}
        columns={getColumns()}
      />
    </div>
  );
}

function PersonalInvitesTableFilters(props: {
  filters: z.infer<typeof FiltersSchema>;
}) {
  const { t } = useTranslation(['admin']);
  const form = useForm({
    resolver: zodResolver(FiltersSchema),
    defaultValues: {
      status: props.filters?.status ?? 'all',
      query: props.filters?.query ?? '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const router = useRouter();
  const pathName = usePathname();

  const onSubmit = ({ status, query }: z.infer<typeof FiltersSchema>) => {
    const params = new URLSearchParams({
      invite_status: status,
      query: query ?? '',
    });

    const url = `${pathName}?${params.toString()}`;

    router.push(url);
  };

  return (
    <Form {...form}>
      <form
        className={'flex gap-2.5'}
        onSubmit={form.handleSubmit((data) => onSubmit(data))}
      >
        <Select
          value={form.watch('status')}
          onValueChange={(value) => {
            form.setValue(
              'status',
              value as z.infer<typeof FiltersSchema>['status'],
              {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              },
            );

            return onSubmit(form.getValues());
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('admin:personalInvites.filters.statusPlaceholder', 'Invitation Status')} />
          </SelectTrigger>

          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('admin:personalInvites.filters.statusLabel', 'Invitation Status')}</SelectLabel>
              <SelectItem value={'all'}>{t('admin:personalInvites.filters.allInvitations', 'All invitations')}</SelectItem>
              <SelectItem value={'pending'}>{t('admin:personalInvites.filters.pending', 'Pending')}</SelectItem>
              <SelectItem value={'accepted'}>{t('admin:personalInvites.filters.accepted', 'Accepted')}</SelectItem>
              <SelectItem value={'expired'}>{t('admin:personalInvites.filters.expired', 'Expired')}</SelectItem>
              <SelectItem value={'revoked'}>{t('admin:personalInvites.filters.revoked', 'Revoked')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <FormField
          name={'query'}
          render={({ field }) => (
            <FormItem>
              <FormControl className={'w-full min-w-36 md:min-w-80'}>
                <Input
                  data-test={'admin-invites-table-filter-input'}
                  className={'w-full'}
                  placeholder={t('admin:personalInvites.filters.searchPlaceholder', 'Search by email...')}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}

function getColumns(): ColumnDef<PersonalInvite>[] {
  const { t } = useTranslation(['admin']);
  return [
    {
      id: 'email',
      header: t('admin:personalInvites.columns.email', 'Email'),
      accessorKey: 'email',
    },
    {
      id: 'language',
      header: t('admin:personalInvites.columns.language', 'Language'),
      accessorKey: 'language',
      cell: ({ row }) => {
        const language = row.original.language || 'en';
        const languageNames: Record<string, string> = {
          en: t('admin:languages.english', 'English'),
          ru: t('admin:languages.russian', 'Russian'),
        };
        
        return languageNames[language] || language;
      },
    },
    {
      id: 'status',
      header: t('admin:personalInvites.columns.status', 'Status'),
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = row.original.status;
        const statusColors: Record<InviteStatus, string> = {
          pending: 'bg-blue-100 text-blue-800',
          accepted: 'bg-green-100 text-green-800',
          revoked: 'bg-red-100 text-red-800',
        };
        
        // Use existing translations from filters
        const statusLabel = t(`admin:personalInvites.filters.${status}`, status.charAt(0).toUpperCase() + status.slice(1));

        return (
          <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusColors[status]}`}>
            {statusLabel}
          </span>
        );
      },
    },
    {
      id: 'created_at',
      header: t('admin:personalInvites.columns.createdAt', 'Created At'),
      accessorKey: 'created_at',
      cell: ({ row }) => formatDate(new Date(row.original.created_at), 'PPP'),
    },
    {
      id: 'expires_at',
      header: t('admin:personalInvites.columns.expiresAt', 'Expires At'),
      accessorKey: 'expires_at',
      cell: ({ row }) => formatDate(new Date(row.original.expires_at), 'PPP'),
    },
    {
      id: 'accepted_at',
      header: t('admin:personalInvites.columns.acceptedAt', 'Accepted At'),
      accessorKey: 'accepted_at',
      cell: ({ row }) => row.original.accepted_at 
        ? formatDate(new Date(row.original.accepted_at), 'PPP') 
        : '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        return (
          <InviteActionsDropdown invite={row.original} />
        );
      },
    },
  ];
}

function InviteActionsDropdown({ invite }: { invite: PersonalInvite }) {
  const { t } = useTranslation(['admin']);
  const router = useRouter();
  const isPending = invite.status === 'pending';
  const [isRevoking, setIsRevoking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isPendingTransition, startTransition] = useTransition();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      setIsRevoking(true);
      const result = await revokePersonalInviteAction({ id });
      setIsRevoking(false);
      return result;
    },
    onSuccess: () => {
      // Refresh the page to update the UI immediately
      router.refresh();
      
      toast.success(t('admin:personalInvites.actions.revokeSuccess', 'Invitation revoked'), {
        description: t('admin:personalInvites.actions.revokeSuccessDescription', 'The invitation has been successfully revoked.'),
      });
    },
    onError: (error) => {
      toast.error(t('admin:personalInvites.actions.error', 'Error'), {
        description: t('admin:personalInvites.actions.revokeErrorDescription', 'Failed to revoke invitation: {{message}}', { message: error.message }),
      });
    },
  });

  const handleRevoke = () => {
    mutation.mutate(invite.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={'ghost'}>
          <EllipsisVertical className={'h-4'} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={'end'}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('admin:personalInvites.actions.label', 'Actions')}</DropdownMenuLabel>

          {isPending && (
            <>
              <DropdownMenuItem
                disabled={isRevoking || isResending || isPendingTransition}
                onClick={handleRevoke}
              >
                {isRevoking ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t('admin:personalInvites.actions.revoke', 'Revoke Invitation')}
              </DropdownMenuItem>
              
              <DropdownMenuItem
                disabled={isRevoking || isResending || isPendingTransition}
                onClick={() => {
                  setIsResending(true);
                  startTransition(async () => {
                    try {
                      const result = await resendPersonalInviteAction({ id: invite.id });
                      if (result.success) {
                        toast.success(
                          t('admin:personalInvites.actions.resendSuccess', 'Email resent'), 
                          {
                            description: t(
                              'admin:personalInvites.actions.resendSuccessDescription', 
                              'Invitation email resent successfully to {{email}}', 
                              { email: invite.email }
                            )
                          }
                        );
                      }
                    } catch (error: any) {
                      toast.error(
                        t('admin:personalInvites.actions.error', 'Error'), 
                        {
                          description: t(
                            'admin:personalInvites.actions.resendErrorDescription', 
                            'Failed to resend invitation: {{message}}', 
                            { message: error?.message || t('admin:personalInvites.form.somethingWentWrong', 'Something went wrong') }
                          )
                        }
                      );
                    } finally {
                      setIsResending(false);
                    }
                  });
                }}
              >
                {isResending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t('admin:personalInvites.actions.resendEmail', 'Resend Email')}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuItem onClick={() => {
            navigator.clipboard.writeText(invite.email);
            toast.success(t('admin:personalInvites.actions.copied', 'Copied'), {
              description: t('admin:personalInvites.actions.copiedDescription', 'Email address copied to clipboard')
            });
          }}>
            {t('admin:personalInvites.actions.copyEmail', 'Copy Email')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
