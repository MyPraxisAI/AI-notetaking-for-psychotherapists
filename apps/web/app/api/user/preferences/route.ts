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
  async ({ user }) => {
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
        .select('use_24hr_clock, use_us_date_format, language')
        .eq('account_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error(ctx, 'Error fetching user preferences', { error });
        return NextResponse.json({ error: 'Failed to fetch user preferences' }, { status: 500 });
      }

      // If no preferences found, return defaults
      if (!preferences) {
        return NextResponse.json({
          use24HourClock: true,
          useUsDateFormat: false,
        });
      }

      // Map the data to the expected format
      const preferencesData = {
        use24HourClock: preferences && preferences.use_24hr_clock === true,
        useUsDateFormat: preferences && preferences.use_us_date_format === true,
        language: preferences?.language || 'en',
      };

      logger.info(ctx, 'User preferences fetched successfully');
      return NextResponse.json(preferencesData);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch user preferences', { error });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);


