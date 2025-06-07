import { Metadata } from 'next';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
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
  const client = getSupabaseServerClient();
  const params = await searchParams;
  
  const invite_status = params.invite_status ?? 'all';
  const query = params.query ?? '';
  const page = Number(params.page ?? '1');

  const { data: rawData, meta } = await getAdminPersonalInvites({
    page,
    status: invite_status === 'all' ? undefined : invite_status,
    query,
  });
  
  // Transform data to match the expected component structure
  const data = rawData.map(invite => ({
    ...invite,
    invited_account_id: invite.account_id,
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
            status: invite_status as any,
            query,
          }}
        />
      </PageBody>
    </>
  );
}

export default withI18n(AdminGuard(AdminPersonalInvitesPage));
