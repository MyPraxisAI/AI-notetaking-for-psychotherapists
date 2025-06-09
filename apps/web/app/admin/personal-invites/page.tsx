import { Metadata } from 'next';
import { Button } from '@kit/ui/button';
import { PlusIcon } from 'lucide-react';
import { PageBody, PageHeader } from '@kit/ui/page';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { withI18n } from '~/lib/i18n/with-i18n';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';

import { 
  getAdminPersonalInvites,
  AdminPersonalInvitesTable,
  CreatePersonalInvitationDialog
} from '@kit/admin';
import { AdminGuard } from '@kit/admin/components/admin-guard';

export const metadata: Metadata = {
  title: 'Admin | Personal Invitations',
};

interface SearchParams {
  invite_status?: string;
  query?: string;
  page?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

async function AdminPersonalInvitesPage({ searchParams }: PageProps) {
  const { t } = await createI18nServerInstance();
  const params = await searchParams;
  
  const invite_status = params.invite_status ?? 'all';
  const query = params.query ?? '';
  const page = Number(params.page ?? '1');

  const { data: rawData, meta } = await getAdminPersonalInvites({
    page,
    status: invite_status === 'all' ? undefined : invite_status,
    query,
  });
  
  // Define the type for personal invites based on the database structure
  type PersonalInvite = {
    id: string;
    email: string;
    status: 'pending' | 'accepted' | 'revoked';
    invited_by_account_id: string;
    invited_account_id: string | null;
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    token: string;
    language: string;
  };

  // Transform data to match the expected component structure
  const data = rawData.map((invite: PersonalInvite) => ({
    ...invite,
    // Don't attempt to add account_id property since it doesn't exist in the original data
    // Instead, it's already correctly named as invited_account_id in the database
  }));

  return (
    <>
      <PageHeader 
        description={<AppBreadcrumbs />} 
        title={t('admin:personalInvites.pageTitle', 'Personal Invitations')}
      >
        <CreatePersonalInvitationDialog>
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t('admin:personalInvites.createButton', 'Create Invitation')}
          </Button>
        </CreatePersonalInvitationDialog>
      </PageHeader>

      <PageBody className="max-w-6xl">
        <AdminPersonalInvitesTable
          data={data}
          pageCount={meta.pageCount}
          pageSize={meta.pageSize}
          page={meta.page}
          filters={{
            status: invite_status as 'all' | 'pending' | 'accepted' | 'revoked',
            query,
          }}
        />
      </PageBody>
    </>
  );
}

export default withI18n(AdminGuard(AdminPersonalInvitesPage));
