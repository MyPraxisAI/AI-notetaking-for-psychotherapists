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
        // Build the base query
        const baseQuery = adminClient
          .from('accounts')
          .select(`
            *,
            clients!left(
              id,
              demo,
              sessions!left(
                id,
                transcripts!left(
                  id,
                  content_json,
                  duration_ms
                )
              )
            )
          `, { count: 'exact' })
          .eq('clients.demo', false);

        // Apply filters if they exist
        const filters = getFilters(data);
        let query = baseQuery;
        Object.entries(filters).forEach(([key, value]) => {
          if (value.eq !== undefined) {
            query = query.eq(key, value.eq);
          }
          if (value.like !== undefined) {
            query = query.ilike(key, value.like);
          }
        });

        // Apply pagination
        const from = (data.page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);

        // Log the query details
        logger.info({
          ...ctx,
          filters,
          pagination: { from, to },
        }, 'Executing query with filters and pagination');

        // Execute the query
        const { data: accounts, count, error } = await query;

        // Log the raw query result
        logger.info({
          ...ctx,
          error: error ? { message: error.message, details: error.details } : null,
          count,
          rawAccounts: accounts ? accounts.slice(0, 1) : null, // Log just the first account to keep the log size manageable
        }, 'Raw query result');

        if (error) {
          logger.error({ ...ctx, error }, 'Error fetching accounts with sessions');
          throw error;
        }

        // Log the processed results
        logger.info({
          ...ctx,
          accountsCount: accounts?.length ?? 0,
          totalCount: count,
          firstAccount: accounts?.[0] ? {
            id: accounts[0].id,
            clientCount: accounts[0].clients?.length,
            firstClient: accounts[0].clients?.[0] ? {
              id: accounts[0].clients[0].id,
              sessionCount: accounts[0].clients[0].sessions?.length,
              firstSession: accounts[0].clients[0].sessions?.[0]?.id,
              firstTranscript: accounts[0].clients[0].sessions?.[0]?.transcripts?.id
            } : null
          } : null
        }, 'Query results');

        // Calculate session stats for each account
        const accountsWithStats = (accounts ?? []).map((account) => {
          // Get all non-demo sessions across all clients
          const sessions = account.clients?.flatMap(client => 
            client.demo ? [] : (client.sessions ?? [])
          ) ?? [];

          const totalDurationMs = sessions.reduce((sum, session) => {
            const transcript = session.transcripts;
            return sum + (transcript?.duration_ms ?? 0);
          }, 0);

          return {
            ...account,
            sessions_count: sessions.length,
            sessions_duration_seconds: Math.round(totalDurationMs / 1000), // Convert ms to seconds
          };
        });

        return {
          data: accountsWithStats,
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