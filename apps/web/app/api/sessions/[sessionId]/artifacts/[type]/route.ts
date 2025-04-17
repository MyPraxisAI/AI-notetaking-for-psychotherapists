import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage } from '../../../../../../lib/utils/language';

// This route handler returns artifacts for a session
// It will be enhanced with authentication and error handling
export const GET = enhanceRouteHandler(
  async (req) => {
    const { params } = req;
    const { sessionId, type } = params as { sessionId: string; type: string };

    // Define valid artifact types
    type ArtifactType = 'session_therapist_summary' | 'session_client_summary' | 'client_prep_note' | 'client_conceptualization' | 'client_bio';
    
    // Define valid language types
    type LanguageType = 'en' | 'ru';
    
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
    const userLanguage = await getUserLanguage() as LanguageType;
    
    // Fetch the artifact from the database
    const { data: artifact, error } = await client
      .from('artifacts')
      .select('content, language')
      .eq('reference_type', 'session')
      .eq('reference_id', sessionId)
      .eq('type', artifactType)
      .eq('language', userLanguage)
      .single();
    
    // If there's an error or no artifact found
    if (error || !artifact) {
      // In the future, this is where we would generate content with OpenAI
      // For now, return a message that the artifact is missing
      return NextResponse.json({
        content: `This ${artifactType.replace('session_', '').replace('_', ' ')} is not available yet.`,
        language: userLanguage,
        generated: false,
        // Add data-test attribute for E2E testing
        dataTest: `session-artifact-${artifactType}-missing`
      });
    }
    
    // Return the artifact content
    return NextResponse.json({
      content: artifact.content,
      language: artifact.language,
      generated: false,
      // Add data-test attribute for E2E testing
      dataTest: `session-artifact-${artifactType}`
    });
  },
  {
    auth: true,
  }
);
