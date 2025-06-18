import { AdminAccountsTable } from '@kit/admin/components/admin-accounts-table';
import { AdminGuard } from '@kit/admin/components/admin-guard';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';
import { getAccountsWithStatsAction } from './_lib/server/server-actions';

interface SearchParams {
  page?: string;
  account_type?: 'all' | 'personal' | 'team';
  query?: string;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
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
  const sort_field = searchParams.sort_field ?? 'name';
  const sort_direction = searchParams.sort_direction ?? 'asc';

  const { data: accountsWithStats, count } = await getAccountsWithStatsAction({
    page,
    account_type: searchParams.account_type ?? 'all',
    query: searchParams.query ?? '',
    sort_field,
    sort_direction,
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
          sort_field={sort_field}
          sort_direction={sort_direction}
        />
      </PageBody>
    </>
  );
}

export default AdminGuard(AccountsPage);
