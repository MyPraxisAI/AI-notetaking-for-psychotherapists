import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage } from '@kit/web-bg-common';
import { 
  generateArtifact, 
  saveArtifact, 
  ArtifactType, 
  LanguageType 
} from '../../../../../../lib/utils/artifacts';

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
    
    // Fetch the artifact from the database
    const { data: artifact, error } = await client
      .from('artifacts')
      .select('content, language')
      .eq('reference_type', 'session')
      .eq('reference_id', sessionId)
      .eq('type', artifactType)
      .eq('language', userLanguage)
      .single();
    
    // If there's an error or no artifact found, generate it with OpenAI
    if (error || !artifact) {
      try {
        // Get the session data needed for generation
        const { data: session } = await client
          .from('sessions')
          .select('id, note')
          .eq('id', sessionId)
          .single();
        
        // Fetch transcript data from the transcripts table
        const { data: transcriptData } = await client
          .from('transcripts')
          .select('content')
          .eq('session_id', sessionId)
          .single();
          
        const transcriptContent = transcriptData?.content || null;
        
        if (!session || (!transcriptContent && !session.note)) {
          // If there's no session or neither transcript nor note, we can't generate an artifact
          return NextResponse.json({
            content: `This ${artifactType.replace('session_', '').replace('_', ' ')} cannot be generated without either a transcript or session notes.`,
            language: userLanguage,
            generated: false,
            dataTest: `session-artifact-${artifactType}-missing-data`
          });
        }
        
        // Generate the artifact content using OpenAI
        const generatedContent = await generateArtifact(
          artifactType,
          {
            session_transcript: transcriptContent || '',
            session_note: session.note || ''
          }
        );
        
        // Save the generated artifact to the database
        await saveArtifact(
          client,
          sessionId,
          'session',
          artifactType,
          generatedContent,
          userLanguage as LanguageType
        );
        
        // Return the generated content
        return NextResponse.json({
          content: generatedContent,
          language: userLanguage,
          generated: true,
          dataTest: `session-artifact-${artifactType}-generated`
        });
      } catch (generationError) {
        console.error('Error generating artifact:', generationError);
        
        // Return an error message if generation fails
        return NextResponse.json({
          content: `Unable to generate this ${artifactType.replace('session_', '').replace('_', ' ')}. Please try again later.`,
          language: userLanguage,
          generated: false,
          error: true,
          dataTest: `session-artifact-${artifactType}-error`
        }, { status: 500 });
      }
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
