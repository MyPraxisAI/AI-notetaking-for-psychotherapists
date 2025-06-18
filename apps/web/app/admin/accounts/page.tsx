import { AdminAccountsTable } from '@kit/admin/components/admin-accounts-table';
import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';
import { getAccountsWithStatsAction } from './_lib/server/server-actions';

interface SearchParams {
  page?: string;
  account_type?: 'all' | 'personal' | 'team';
  query?: string;
}

interface AdminAccountsPageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata = {
  title: `Accounts`,
};

const PAGE_SIZE = 10;

async function AccountsPage(props: AdminAccountsPageProps) {
  const searchParams = await props.searchParams;
  const page = searchParams.page ? parseInt(searchParams.page) : 1;

  const { data: accountsWithStats, count } = await getAccountsWithStatsAction({
    page,
    account_type: searchParams.account_type ?? 'all',
    query: searchParams.query ?? '',
  });

  const pageCount = Math.ceil(count / PAGE_SIZE);

  return (
    <>
      <PageHeader>
        <AppBreadcrumbs
          values={{
            admin: 'Admin',
            'admin.accounts': 'Accounts',
          }}
        />
      </PageHeader>

      <PageBody>
        <AdminAccountsTable
          data={accountsWithStats ?? []}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          page={page}
          filters={{
            type: searchParams.account_type ?? 'all',
            query: searchParams.query ?? '',
          }}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AccountsPage);
