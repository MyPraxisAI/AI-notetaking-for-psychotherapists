import { enhanceRouteHandler } from '@kit/shared/enhance-route-handler';
import { logger } from '@kit/shared/logger';

import { getSupabaseServerClient } from '~/supabase/server-client';

export const GET = enhanceRouteHandler({
  auth: true,
  handler: async (request, { user }) => {
    const ctx = {
      name: 'get-user-preferences',
      userId: user.id,
    };

    logger.info(ctx, 'Fetching user preferences...');

    try {
      const client = getSupabaseServerClient();
      
      // Fetch user preferences
      const { data: preferences, error } = await client
        .from('user_preferences')
        .select('use_24_hour_clock, use_international_date_format')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error(ctx, 'Error fetching user preferences', { error });
        return Response.json({ error: 'Failed to fetch user preferences' }, { status: 500 });
      }

      // If no preferences found, return defaults
      if (!preferences) {
        return Response.json({
          use24HourClock: true,
          useInternationalDateFormat: true,
        });
      }

      // Map the data to the expected format
      const preferencesData = {
        use24HourClock: preferences.use_24_hour_clock,
        useInternationalDateFormat: preferences.use_international_date_format,
      };

      logger.info(ctx, 'User preferences fetched successfully');
      return Response.json(preferencesData);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch user preferences', { error });
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
});
