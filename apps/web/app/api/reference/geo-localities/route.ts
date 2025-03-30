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
      name: 'get-geo-localities',
      userId: user.id,
    };

    logger.info(ctx, 'Fetching geographic localities...');

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Fetch geo localities
      const { data: localities, error } = await client
        .from('geo_localities')
        .select('id, name')
        .order('name');
      
      if (error) {
        logger.error(ctx, 'Error fetching geographic localities', { error });
        return Response.json({ error: 'Failed to fetch geographic localities' }, { status: 500 });
      }

      logger.info(ctx, 'Geographic localities fetched successfully');
      return Response.json(localities);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch geographic localities', { error });
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  {
    auth: true
  }
);
