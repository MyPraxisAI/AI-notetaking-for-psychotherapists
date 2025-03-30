import { enhanceRouteHandler } from '@kit/shared/enhance-route-handler';
import { logger } from '@kit/shared/logger';

import { getSupabaseServerClient } from '~/supabase/server-client';

export const GET = enhanceRouteHandler({
  auth: true,
  handler: async (request, { user }) => {
    const ctx = {
      name: 'get-therapist-profile',
      userId: user.id,
    };

    logger.info(ctx, 'Fetching therapist profile...');

    try {
      const client = getSupabaseServerClient();
      
      // Fetch therapist record
      const { data: therapist, error: therapistError } = await client
        .from('therapists')
        .select(`
          id, 
          full_name, 
          credentials, 
          language,
          geo_localities(id, name),
          therapeutic_approaches!therapists_primary_therapeutic_approach_id_fkey(id, name)
        `)
        .eq('user_id', user.id)
        .single();
      
      if (therapistError && therapistError.code !== 'PGRST116') {
        logger.error(ctx, 'Error fetching therapist record', { error: therapistError });
        return Response.json({ error: 'Failed to fetch therapist profile' }, { status: 500 });
      }

      // If no therapist record found, return null
      if (!therapist) {
        return Response.json(null);
      }

      // Fetch secondary therapeutic approaches
      const { data: secondaryApproaches, error: approachesError } = await client
        .from('therapists_approaches')
        .select(`
          therapeutic_approaches(id, name)
        `)
        .eq('therapist_id', therapist.id);
      
      if (approachesError) {
        logger.error(ctx, 'Error fetching secondary approaches', { error: approachesError });
        return Response.json({ error: 'Failed to fetch therapeutic approaches' }, { status: 500 });
      }

      // Map the data to the expected format
      const profileData = {
        id: therapist.id,
        fullName: therapist.full_name,
        credentials: therapist.credentials || '',
        country: therapist.geo_localities?.name || '',
        primaryTherapeuticApproach: therapist.therapeutic_approaches?.name || '',
        secondaryTherapeuticApproaches: secondaryApproaches
          ? secondaryApproaches.map(a => a.therapeutic_approaches.name)
          : [],
        language: therapist.language || '',
      };

      logger.info(ctx, 'Therapist profile fetched successfully');
      return Response.json(profileData);
    } catch (error) {
      logger.error(ctx, 'Failed to fetch therapist profile', { error });
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  },
});
