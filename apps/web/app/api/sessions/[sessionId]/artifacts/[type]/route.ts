import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage, generateArtifact, saveArtifact, getOrCreateArtifact } from '@kit/web-bg-common';
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
      
      // Prepare variable data for the artifact
      const variableData = {
        session_transcript: transcriptContent || '',
        session_note: session.note || ''
      };
      
      // Get or create the artifact
      const { content, language, isNew } = await getOrCreateArtifact(
        client,
        sessionId,
        'session',
        artifactType,
        userLanguage,
        variableData
      );
      
      // Return the artifact
      return NextResponse.json({
        content,
        language,
        generated: isNew,
        dataTest: isNew ? `session-artifact-${artifactType}-generated` : `session-artifact-${artifactType}`
      });
    } catch (error) {
      console.error('Error getting or creating artifact:', error);
      
      // Return an error message if generation fails
      return NextResponse.json({
        content: `Unable to generate this ${artifactType.replace('session_', '').replace('_', ' ')}. Please try again later.`,
        language: userLanguage,
        generated: false,
        error: true,
        dataTest: `session-artifact-${artifactType}-error`
      }, { status: 500 });
    }
  },
  {
    auth: true,
  }
);
