import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { 
  getUserLanguage, 
  generateArtifact, 
  saveArtifact, 
  createPromptApi,
  getOrCreateArtifact,
  extractTemplateVariables,
  validateTemplateVariables
} from '@kit/web-bg-common';
import type { ArtifactType, LanguageType } from '@kit/web-bg-common/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// These functions have been moved to @kit/web-bg-common/artifacts.ts

/**
 * Generate data for template variables
 * @param client Supabase client
 * @param clientId Client ID
 * @param artifactType Type of artifact being generated
 * @param variables Array of variable names to generate data for
 * @returns Object mapping variable names to their values
 */
async function generateVariableData(
  client: SupabaseClient,
  clientId: string,
  artifactType: ArtifactType,
  variables: string[]
): Promise<Record<string, string>> {
  const variableData: Record<string, string> = {};
  
  // Generate data for each variable
  for (const variable of variables) {
    variableData[variable] = await generateVariableValue(client, clientId, variable);
  }
  
  return variableData;
}

/**
 * Generate value for a specific template variable
 * @param client Supabase client
 * @param clientId Client ID
 * @param variableName Name of the variable to generate value for
 * @returns Generated value for the variable
 */
async function generateVariableValue(
  client: SupabaseClient,
  clientId: string,
  variableName: string
): Promise<string> {
  const variableGenerators: Record<string, (client: SupabaseClient, clientId: string) => Promise<string>> = {
    full_session_contents: generateFullSessionContents,
    last_session_content: generateLastSessionContent,
    session_summaries: generateSessionSummaries,
    client_conceptualization: generateClientConceptualization,
    client_bio: generateClientBio
  };
  
  const generator = variableGenerators[variableName];
  if (!generator) {
    throw new Error(`No generator found for variable: ${variableName}`);
  }
  
  return generator(client, clientId);
}

/**
 * Generate full session contents for a client
 * @param client Supabase client
 * @param clientId Client ID
 * @returns Formatted session contents
 */
async function generateFullSessionContents(client: SupabaseClient, clientId: string): Promise<string> {
  // Get all sessions for the client
  console.log(`Fetching sessions for client ${clientId}`);
  const { data: sessions, error } = await client
    .from('sessions')
    .select('id, title, note, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching sessions:', error);
    return 'Error fetching session data.';
  }

  // Create a map to store transcripts by session ID
  const transcriptsMap: Record<string, string> = {};
  
  // If we have sessions, fetch all related transcripts
  if (sessions && sessions.length > 0) {
    const sessionIds = sessions.map(session => session.id);
    const { data: transcripts, error: transcriptsError } = await client
      .from('transcripts')
      .select('session_id, content')
      .in('session_id', sessionIds);
    
    if (transcriptsError) {
      console.error('Error fetching transcripts:', transcriptsError);
    } else if (transcripts) {
      // Create a map of session_id to transcript content
      transcripts.forEach(transcript => {
        transcriptsMap[transcript.session_id] = transcript.content;
      });
    }
  }

  // Format the session data for the prompt
  return sessions && sessions.length > 0 ? sessions.map((session: { id: string; title?: string; note?: string; created_at: string }) => {
    const date = new Date(session.created_at).toLocaleDateString();
    let content = `## Session on ${date} - ${session.title || 'Untitled'}\n\n`;
    
    // Check if we have a transcript for this session
    const transcriptContent = transcriptsMap[session.id];
    if (transcriptContent) {
      content += `### Transcript:\n${transcriptContent}\n\n`;
    }
    
    if (session.note) {
      content += `### Therapist Notes:\n${session.note}\n\n`;
    }
    
    return content;
  }).join('---\n\n') : 'No session data available.';
}

/**
 * Generate last session content for a client
 * @param client Supabase client
 * @param clientId Client ID
 * @returns Formatted last session content
 */
async function generateLastSessionContent(client: SupabaseClient, clientId: string): Promise<string> {
  // Get the most recent session for the client
  console.log(`Fetching most recent session for client ${clientId}`);
  const { data: lastSession, error } = await client
    .from('sessions')
    .select('id, title, note, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (error) {
    console.error('Error fetching last session:', error);
  }
  
  console.log(`Last session found: ${lastSession ? 'Yes' : 'No'}`);
  if (lastSession) {
    console.log(`Last session ID: ${lastSession.id}, Title: ${lastSession.title || 'Untitled'}`);
  }
  
  // Format the last session content
  if (!lastSession) {
    return 'No previous session data available.';
  }
  
  // Fetch transcript from the transcripts table
  let transcriptContent = null;
  if (lastSession.id) {
    const { data: transcriptData, error: transcriptError } = await client
      .from('transcripts')
      .select('content')
      .eq('session_id', lastSession.id)
      .maybeSingle();
      
    if (transcriptError) {
      console.error('Error fetching transcript:', transcriptError);
    } else if (transcriptData) {
      transcriptContent = transcriptData.content;
    }
  }
  
  const date = new Date(lastSession.created_at).toLocaleDateString();
  let content = `## Session on ${date} - ${lastSession.title || 'Untitled'}\n\n`;
  
  if (transcriptContent) {
    content += `### Transcript:\n${transcriptContent}\n\n`;
  }
  
  if (lastSession.note) {
    content += `### Therapist Notes:\n${lastSession.note}\n\n`;
  }
  
  return content;
}

/**
 * Generate session summaries for a client
 * @param client Supabase client
 * @param clientId Client ID
 * @returns Empty string (not implemented yet)
 */
async function generateSessionSummaries(_client: SupabaseClient, _clientId: string): Promise<string> {
  // Not implemented yet, YSTM-578
  return '';
}

/**
 * Generate or fetch client conceptualization
 * @param client Supabase client
 * @param clientId Client ID
 * @returns Client conceptualization content
 */
async function generateClientConceptualization(client: SupabaseClient, clientId: string): Promise<string> {
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  // Generate variable data for the client
  const variableData = await generateVariableData(client, clientId, 'client_conceptualization', ['full_session_contents']);
  
  // Get or create the conceptualization
  const { content } = await getOrCreateArtifact(
    client,
    clientId,
    'client',
    'client_conceptualization',
    userLanguage,
    variableData
  );
  
  return content;
}

/**
 * Generate or fetch client bio
 * @param client Supabase client
 * @param clientId Client ID
 * @returns Client bio content
 */
async function generateClientBio(client: SupabaseClient, clientId: string): Promise<string> {
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  // Generate variable data for the client
  const variableData = await generateVariableData(client, clientId, 'client_bio', ['full_session_contents']);
  
  // Get or create the bio
  const { content } = await getOrCreateArtifact(
    client,
    clientId,
    'client',
    'client_bio',
    userLanguage,
    variableData
  );
  
  return content;
}

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
      // Generate variable data for the artifact
      const templateVariables = [
        'full_session_contents',
        'last_session_content',
        'client_conceptualization',
        'client_bio'
      ];
      const variableData = await generateVariableData(client, clientId, artifactType, templateVariables);
      
      // Get or create the artifact
      const { content, language, isNew } = await getOrCreateArtifact(
        client, 
        clientId, 
        'client', 
        artifactType, 
        userLanguage,
        variableData
      );
      
      // Return the artifact
      return NextResponse.json({
        content,
        language,
        generated: true,
        isNew,
        dataTest: `client-artifact-${artifactType}`
      });
    } catch (error) {
      console.error(`Error getting or creating ${artifactType}:`, error);
      return NextResponse.json(
        { error: `Failed to get or create ${artifactType}: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  },
  {
    auth: true,
  }
);
