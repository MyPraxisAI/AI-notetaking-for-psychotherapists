// NextResponse is used implicitly by the enhanceRouteHandler
import type { NextResponse as _NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

// Initialize logger properly with await
const logger = await getLogger();

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => ReturnType<SupabaseClient['from']>;
};

export const GET = enhanceRouteHandler(
  async ({ request: _request, user }) => {
    const ctx = {
      name: 'get-geo-localities',
      userId: user?.id || 'anonymous',
    };

    try {
      const client = getSupabaseServerClient() as CustomClient;
      
      // Fetch geo localities
      const { data: localities, error } = await client
        .from('geo_localities')
        .select('id, name, title')
        .order('name');
      
      if (error) {
        logger.error(ctx, 'Error fetching geographic localities', { error });
        return Response.json({ error: 'Failed to fetch geographic localities' }, { status: 500 });
      }
      
      // Map the database results to the expected format
      // We'll let the client handle translations
      const geoLocalities = localities.map(locality => ({
        id: locality.id, // Use the actual UUID as the ID
        name: locality.name,
        title: locality.title // Use name as fallback since there's no title column
      }));
      
      // Sort the localities by title, but ensure 'other' is always last
      const sortedLocalities = [...geoLocalities].sort((a, b) => {
        if (a.name === 'other') return 1;
        if (b.name === 'other') return -1;
        return a.title.localeCompare(b.title);
      });

      return Response.json(sortedLocalities);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch geographic localities', { error });
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
  {
    auth: true
  }
);
