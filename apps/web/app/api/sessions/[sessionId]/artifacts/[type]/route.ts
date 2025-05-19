import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { 
  getOrCreateArtifact,
  getArtifact,
  getSessionContent
} from '@kit/web-bg-common';
import type { ArtifactType } from '@kit/web-bg-common/types';

// This route handler returns artifacts for a session
// It will be enhanced with authentication and error handling
export const GET = enhanceRouteHandler(
  async (req) => {
    const { params } = req;
    const { sessionId, type } = params as { sessionId: string; type: string };

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
    
    
    try {
      // Get the artifact from the database
      const artifact = await getArtifact(
        client,
        sessionId,
        'session',
        artifactType
      );
      
      // If the artifact doesn't exist, trigger regeneration and return a 404 response
      if (!artifact) {
        
        // Temporary Code: trigger generation of session artifacts (since they might not have been eagerly generated before)
        // Later we can remove this (or just pregenerate all the artifacts using a script)

        try {
          // Check if the session has a transcript or note before generating
          const session = await getSessionContent(client, sessionId);

          // Only generate if we have content to generate from
          if (session && (session.transcript || session.note)) {
            console.log(`Session ${sessionId} has content, attempting to create artifact`);
            
            // Use getOrCreateArtifact to generate the specific artifact
            const result = await getOrCreateArtifact(
              client,
              sessionId,
              'session',
              artifactType
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
          } else {
            console.log(`Session ${sessionId} has no content yet, skipping artifact generation`);
            return NextResponse.json(
              { error: 'Session has no content yet' },
              { status: 404 }
            );
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
