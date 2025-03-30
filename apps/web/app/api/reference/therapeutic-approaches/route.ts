import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { SupabaseClient } from '@supabase/supabase-js';

// Initialize logger
let logger: any;
getLogger().then((l) => {
  logger = l;
});

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => any;
};

export const GET = enhanceRouteHandler(
  async ({ request, user }) => {
    const ctx = {
      name: 'get-therapeutic-approaches',
      userId: user.id,
    };

    logger.info(ctx, 'Fetching therapeutic approaches...');

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Fetch therapeutic approaches
      const { data: approaches, error } = await client
        .from('therapeutic_approaches')
        .select('id, name, title')
        .order('name');
      
      if (error) {
        logger.error(ctx, 'Error fetching therapeutic approaches', { error });
        return Response.json({ error: 'Failed to fetch therapeutic approaches' }, { status: 500 });
      }

      logger.info(ctx, 'Therapeutic approaches fetched successfully');
      return Response.json(approaches);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch therapeutic approaches', { error });
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  {
    auth: true
  }
);
