import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { 
  getUserLanguage,
  getOrCreateArtifact
} from '@kit/web-bg-common';
import { getArtifact } from '@kit/web-bg-common/db/artifact-api';
import type { ArtifactType, LanguageType } from '@kit/web-bg-common/types';

// This route handler returns artifacts for a session
// It will be enhanced with authentication and error handling
export const GET = enhanceRouteHandler(
  async (req) => {
    const { params } = req;
    const { sessionId, type } = params as { sessionId: string; type: string };

    // Use the ArtifactType and LanguageType from the openai utility
    
    // Validate the artifact type
    if (!['session_therapist_summary', 'session_client_summary'].includes(type)) {
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
        sessionId,
        'session',
        artifactType,
        userLanguage
      );
      
      // If the artifact doesn't exist, trigger regeneration and return a 404 response
      if (!artifact) {
        
        // Temporary Code: trigger generation of session artifacts (since they might not have been eagerly generated before)
        // Later we can remove this (or just pregenerate all the artifacts using a script)

        try {
          // Try to generate the artifact on-demand
          console.log(`Artifact not found, attempting to create it for session ${sessionId}`);
          
          // Use getOrCreateArtifact to generate the specific artifact
          const result = await getOrCreateArtifact(
            client,
            sessionId,
            'session',
            artifactType,
            userLanguage
          );
          
          if (result && result.content) {
            // If we successfully created the artifact, return it immediately
            console.log(`Successfully created artifact for session ${sessionId}`);
            return NextResponse.json({
              content: result.content,
              language: result.language,
              stale: false,
              dataTest: `session-artifact-${artifactType}`
            });
          }
        } catch (genError) {
          // Log the error but continue to return 404
          console.error(`Error generating artifact for session ${sessionId}:`, genError);
        }

        return NextResponse.json(
          { error: 'Artifact not found' },
          { status: 404 }
        );
      }
      
      // Return the artifact with all its data including the stale field
      return NextResponse.json({
        ...artifact,
        dataTest: `session-artifact-${artifactType}`
      });
    } catch (error) {
      console.error('Error fetching artifact:', error);
      
      // Return an error message if fetching fails
      return NextResponse.json({
        error: 'Failed to fetch artifact',
        dataTest: `session-artifact-${artifactType}-error`
      }, { status: 500 });
    }
  },
  {
    auth: true,
  }
);
