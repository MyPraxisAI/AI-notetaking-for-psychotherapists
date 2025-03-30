import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => any;
};

// Initialize logger properly with await
const logger = await getLogger();

export const GET = enhanceRouteHandler(
  async ({ request, user }) => {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const ctx = {
      name: 'get-user-preferences',
      userId: user.id,
    };

    logger.info(ctx, 'Fetching user preferences...');

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Fetch user preferences
      const { data: preferences, error } = await client
        .from('user_preferences')
        .select('time_format, date_format')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error(ctx, 'Error fetching user preferences', { error });
        return NextResponse.json({ error: 'Failed to fetch user preferences' }, { status: 500 });
      }

      // If no preferences found, return defaults
      if (!preferences) {
        return NextResponse.json({
          use24HourClock: true,
          useInternationalDateFormat: true,
        });
      }

      // Map the data to the expected format
      const preferencesData = {
        use24HourClock: preferences && preferences.time_format === '24h',
        useInternationalDateFormat: preferences && preferences.date_format === 'international',
      };

      logger.info(ctx, 'User preferences fetched successfully');
      return NextResponse.json(preferencesData);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch user preferences', { error });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
