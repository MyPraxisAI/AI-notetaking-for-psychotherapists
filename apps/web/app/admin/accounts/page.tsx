import { AdminAccountsTable } from '@kit/admin/components/admin-accounts-table';
import { AdminGuard } from '@kit/admin/components/admin-guard';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody, PageHeader } from '@kit/ui/page';
import type { Database } from '@kit/supabase/database';

interface SearchParams {
  page?: string;
  account_type?: 'all' | 'team' | 'personal';
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
  const client = getSupabaseServerClient();
  const searchParams = await props.searchParams;

  const page = searchParams.page ? parseInt(searchParams.page) : 1;
  const filters = getFilters(searchParams);
  
  // Get accounts with pagination
  let accountsQuery = client
    .from('accounts')
    .select('*', { count: 'exact' });

  // Apply filters if they exist
  if (filters.is_personal_account?.eq !== undefined) {
    accountsQuery = accountsQuery.eq('is_personal_account', filters.is_personal_account.eq === 'personal');
  }
  if (filters.name?.like) {
    accountsQuery = accountsQuery.ilike('name', filters.name.like);
  }

  const { data: accounts, error: accountsError, count } = await accountsQuery
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
    .order('created_at', { ascending: false });

  if (accountsError) {
    throw accountsError;
  }

  // Get session counts for each account, excluding demo client sessions
  const sessionCounts = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const { count } = await client
        .from('sessions')
        .select('*, clients(demo)', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .or('clients.demo.is.false,clients.demo.is.null');

      return {
        accountId: account.id,
        count: count ?? 0
      };
    })
  );

  // Create a map of account ID to session count
  const sessionCountMap = Object.fromEntries(
    sessionCounts.map(({ accountId, count }) => [accountId, count])
  );

  const pageCount = Math.ceil((count ?? 0) / PAGE_SIZE);

  // Transform the data to include session counts
  const transformedData = accounts?.map(account => ({
    ...account,
    sessions_count: sessionCountMap[account.id] ?? 0
  })) ?? [];

  return (
    <>
      <PageHeader description={<AppBreadcrumbs />} />

      <PageBody>
        <AdminAccountsTable
          page={page}
          pageSize={PAGE_SIZE}
          pageCount={pageCount}
          data={transformedData}
          filters={{
            type: searchParams.account_type ?? 'all',
            query: searchParams.query ?? '',
          }}
        />
      </PageBody>
    </>
  );
}

function getFilters(params: SearchParams) {
  const filters: Record<
    string,
    {
      eq?: string;
      like?: string;
    }
  > = {};

  if (params.account_type && params.account_type !== 'all') {
    filters.is_personal_account = {
      eq: params.account_type,
    };
  }

  if (params.query) {
    filters.name = {
      like: `%${params.query}%`,
    };
  }

  return filters;
}

export default AdminGuard(AccountsPage);
