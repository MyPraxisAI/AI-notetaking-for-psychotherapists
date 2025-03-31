import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => any;
};

// Therapeutic approach IDs will be loaded from the database

export const GET = enhanceRouteHandler(
  async ({ request, user }) => {
    const ctx = {
      name: 'get-therapeutic-approaches',
      userId: user?.id || 'anonymous',
    };

    try {
      // Get the Supabase client
      const client = getSupabaseServerClient() as CustomClient;
      
      // Fetch therapeutic approaches from the database
      const { data: approachesData, error } = await client
        .from('therapeutic_approaches')
        .select('id, name, title')
        .order('name');
      
      if (error) {
        logger.error(ctx, 'Error fetching therapeutic approaches from database', { error });
        return Response.json({ error: 'Failed to fetch therapeutic approaches' }, { status: 500 });
      }
      
      // Map the database results to the expected format
      // We'll let the client handle translations
      const approaches = approachesData.map(approach => ({
        id: approach.id, // Use the actual UUID as the ID
        name: approach.name,
        title: approach.title // Keep the original title as fallback
      }));
      
      // Sort the approaches by title, but ensure 'other' is always last
      const sortedApproaches = [...approaches].sort((a, b) => {
        if (a.name === 'other') return 1;
        if (b.name === 'other') return -1;
        return a.title.localeCompare(b.title);
      });
      
      return Response.json(sortedApproaches);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch therapeutic approaches', { error });
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  {
    auth: true
  }
);
