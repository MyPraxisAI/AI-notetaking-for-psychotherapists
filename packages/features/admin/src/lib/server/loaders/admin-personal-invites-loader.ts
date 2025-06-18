import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getLogger } from '@kit/shared/logger';

const DEFAULT_PAGE_SIZE = 10;

interface GetAdminPersonalInvitesParams {
  page?: number;
  status?: string | null; // Using string here to allow 'all' as a filter option
  query?: string;
}

export async function getAdminPersonalInvites({
  page = 1,
  status,
  query,
}: GetAdminPersonalInvitesParams) {
  const logger = await getLogger();
  const client = getSupabaseServerAdminClient();
  const pageSize = DEFAULT_PAGE_SIZE;
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const ctx = {
    name: 'admin-personal-invites-loader',
    page,
    status,
    query,
  };

  logger.info(ctx, 'Loading admin personal invites...');

  try {
    let queryBuilder = client
      .from('personal_invites')
      .select('*', { count: 'exact' });

    // Apply status filter if provided
    if (status && status !== 'all') {
      if (status === 'expired') {
        // For expired status, check if expires_at is in the past
        queryBuilder = queryBuilder.lt('expires_at', 'now()');
      } else if (status === 'pending') {
        // For pending status, check both status and that it hasn't expired
        queryBuilder = queryBuilder
          .eq('status', status as 'pending')
          .gt('expires_at', 'now()');
      } else if (['accepted', 'revoked'].includes(status)) {
        // For other statuses, use the status field
        queryBuilder = queryBuilder.eq('status', status as 'accepted' | 'revoked');
      }
    }

    // Apply search filter if provided
    if (query) {
      queryBuilder = queryBuilder.ilike('email', `%${query}%`);
    }

    // Get paginated results
    const { data, count, error } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(rangeFrom, rangeTo);

    if (error) {
      logger.error({ ...ctx, error }, 'Failed to load admin personal invites');
      throw error;
    }

    const totalCount = count || 0;
    const pageCount = Math.ceil(totalCount / pageSize);

    logger.info({ ...ctx, totalCount, pageCount }, 'Admin personal invites loaded successfully');

    return {
      data,
      meta: {
        totalCount,
        pageCount,
        page,
        pageSize,
      },
    };
  } catch (error) {
    logger.error({ ...ctx, error }, 'Failed to load admin personal invites');
    throw error;
  }
}
