import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { 
  getUserLanguage
} from '@kit/web-bg-common';
import { getArtifact } from '@kit/web-bg-common/db/artifact-api';
import type { ArtifactType, LanguageType } from '@kit/web-bg-common/types';

// This route handler returns artifacts for a client
export const GET = enhanceRouteHandler(
  async (req) => {
    const { params } = req;
    const { clientId, type } = params as { clientId: string; type: string };
    // Validate the artifact type
    if (!['client_prep_note', 'client_conceptualization', 'client_bio'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid artifact type' },
        { status: 400 }
      );
    }
    
    // Cast the type to a valid artifact type
    const artifactType = type as ArtifactType;

    // Get the Supabase client for database access
    const client = getSupabaseServerClient();
    
    // Get the user's preferred language
    const userLanguage = await getUserLanguage(client) as LanguageType;
    
    try {
      // Get the artifact from the database
      const artifact = await getArtifact(
        client, 
        clientId, 
        'client', 
        artifactType
      );
      
      // If the artifact doesn't exist, return a 404 response
      if (!artifact) {
        return NextResponse.json(
          { error: 'Artifact not found' },
          { status: 404 }
        );
      }
      
      // Return the artifact with all its data including the stale field
      return NextResponse.json({
        ...artifact,
        dataTest: `client-artifact-${artifactType}`
      });
    } catch (error) {
      console.error(`Error fetching artifact:`, error);
      
      // Return an error message if fetching fails
      return NextResponse.json({
        error: 'Failed to fetch artifact',
        dataTest: `client-artifact-${artifactType}-error`
      }, { status: 500 });
    }
  },
  {
    auth: true,
  }
);
