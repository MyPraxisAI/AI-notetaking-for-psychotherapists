'use server';

import { z } from 'zod';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getLogger } from '@kit/shared/logger';
import { adminAction } from '@kit/admin';
import type { Database } from '@kit/supabase/database';

const PAGE_SIZE = 10;

// Schema for the search params
const GetAccountsSchema = z.object({
  page: z.number().min(1),
  account_type: z.enum(['all', 'personal', 'team']),
  query: z.string().optional(),
  sort_field: z.string().optional(),
  sort_direction: z.enum(['asc', 'desc']).optional(),
}).required();

type GetAccountsData = z.infer<typeof GetAccountsSchema>;

function getFilters(params: GetAccountsData) {
  const filters: Record<string, { eq?: boolean; like?: string }> = {};

  if (params.account_type && params.account_type !== 'all') {
    filters.is_personal_account = {
      eq: params.account_type === 'personal',
    };
  }

  if (params.query) {
    filters.name = {
      like: `%${params.query}%`,
    };
  }

  return filters;
}

export const getAccountsWithStatsAction = adminAction(
  enhanceAction(
    async (data: GetAccountsData) => {
      const logger = await getLogger();
      const adminClient = getSupabaseServerAdminClient();
      const ctx = { name: 'get-accounts-with-stats', ...data };

      logger.info(ctx, 'Fetching accounts with session stats');

      try {
        // Allowed sort fields
        const allowedSortFields = [
          'id',
          'name',
          'email',
          'created_at',
          'updated_at',
          'sessions_count',
          'sessions_duration_seconds',
        ];

        if (data.sort_field && !allowedSortFields.includes(data.sort_field)) {
          logger.error({ ...ctx, sort_field: data.sort_field }, 'Invalid sort_field');
          // Return a 400 error
          const error = new Error(`Invalid sort_field: ${data.sort_field}`);
          // @ts-ignore
          error.status = 400;
          throw error;
        }

        // Query the view directly
        let query = adminClient
          .from('admin_accounts_with_stats')
          .select('*', { count: 'exact' });

        // Apply filters if they exist
        const filters = getFilters(data);
        Object.entries(filters).forEach(([key, value]) => {
          if (value.eq !== undefined) {
            query = query.eq(key, value.eq);
          }
          if (value.like !== undefined) {
            query = query.ilike(key, value.like);
          }
        });

        // Apply sorting if provided
        if (data.sort_field && data.sort_direction) {
          query = query.order(data.sort_field, { ascending: data.sort_direction === 'asc' });
        }

        // Apply pagination
        const from = (data.page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);

        // Execute the query
        const { data: accounts, count, error } = await query;

        if (error) {
          logger.error({ ...ctx, error }, 'Error fetching accounts with sessions');
          throw error;
        }

        return {
          data: accounts,
          count: count ?? 0,
        };
      } catch (error) {
        logger.error({ ...ctx, error }, 'Error fetching accounts with sessions');
        throw error;
      }
    },
    {
      schema: GetAccountsSchema,
    }
  )
); 