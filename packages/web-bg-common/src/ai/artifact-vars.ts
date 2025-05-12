import { SupabaseClient } from '@supabase/supabase-js';
import { getUserLanguage, getOrCreateArtifact } from '..';
import type { ArtifactType, LanguageType, VariableContext } from '../types';
import { getLogger } from '../logger';

/**
 * Generate data for template variables
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @param artifactType Artifact type
 * @param variables Array of variable names
 * @returns Object with variable data
 */
export async function generateVariableData(
  client: SupabaseClient,
  variableContext: VariableContext,
  artifactType: ArtifactType,
  variables: string[]
): Promise<Record<string, string>> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-variable-data',
    contextType: variableContext.contextType,
    contextId: variableContext.contextId
  };

  logger.info(ctx, `Generating variable data for ${artifactType}`);

  const variableData: Record<string, string> = {};

  for (const variable of variables) {
    variableData[variable] = await generateVariableValue(client, variableContext, variable);
  }
  
  return variableData;
}

/**
 * Generate a value for a specific template variable
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @param variable Variable name
 * @returns Generated value
 */
async function generateVariableValue(
  client: SupabaseClient,
  variableContext: VariableContext,
  variable: string
): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-variable-value',
    contextType: variableContext.contextType,
    contextId: variableContext.contextId,
    variable
  };

  logger.info(ctx, `Generating value for variable: ${variable}`);
  
  const variableGenerators: Record<string, (client: SupabaseClient, context: VariableContext) => Promise<string>> = {
    full_session_contents: generateFullSessionContents,
    last_session_content: generateLastSessionContent,
    session_summaries: generateSessionSummaries,
    client_conceptualization: generateClientConceptualization,
    client_bio: generateClientBio
  };
  
  // Check if we have a generator for this variable
  if (!(variable in variableGenerators)) {
    logger.warn(ctx, `No generator found for variable: ${variable}`);
    return `[No data available for ${variable}]`;
  }
  
  try {
    // Generate the value using the appropriate generator
    const value = await variableGenerators[variable](client, variableContext);
    return value;
  } catch (error) {
    logger.error(ctx, `Error generating value for ${variable}:`, error);
    return `[Error generating data for ${variable}]`;
  }
}

/**
 * Generate full session contents for a client
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Formatted session contents
 */
export async function generateFullSessionContents(client: SupabaseClient, variableContext: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    throw new Error('Full session contents generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  const logger = await getLogger();
  const ctx = {
    name: 'generate-full-session-contents',
    clientId
  };

  // Get all sessions for the client
  logger.info(ctx, `Fetching sessions for client ${clientId}`);
  const { data: sessions, error } = await client
    .from('sessions')
    .select('id, title, note, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  if (error) {
    logger.error(ctx, 'Error fetching sessions:', error);
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
      logger.error(ctx, 'Error fetching transcripts:', transcriptsError);
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
 * Generate content from the last session
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Formatted last session content
 */
export async function generateLastSessionContent(client: SupabaseClient, variableContext: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    throw new Error('Last session content generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  const logger = await getLogger();
  const ctx = {
    name: 'generate-last-session-content',
    clientId
  };

  // Get the most recent session for the client
  logger.info(ctx, `Fetching most recent session for client ${clientId}`);
  const { data: lastSession, error } = await client
    .from('sessions')
    .select('id, title, note, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
    
  if (error) {
    logger.error(ctx, 'Error fetching last session:', error);
  }
  
  logger.info(ctx, `Last session found: ${lastSession ? 'Yes' : 'No'}`);
  if (lastSession) {
    logger.info(ctx, `Last session ID: ${lastSession.id}, Title: ${lastSession.title || 'Untitled'}`);
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
      logger.error(ctx, 'Error fetching transcript:', transcriptError);
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
 * @param variableContext Context for variable generation
 * @returns Formatted session summaries
 */
export async function generateSessionSummaries(client: SupabaseClient, variableContext: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    throw new Error('Session summaries generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  // Not implemented yet, YSTM-578
  return '';
}

/**
 * Generate client conceptualization
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Client conceptualization
 */
export async function generateClientConceptualization(client: SupabaseClient, variableContext: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    throw new Error('Client conceptualization generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  // Generate variable data for the client
  const variableData = await generateVariableData(client, variableContext, 'client_conceptualization', ['full_session_contents']);
  
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
 * Generate client bio
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Client bio
 */
export async function generateClientBio(client: SupabaseClient, variableContext: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    throw new Error('Client bio generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  // Generate variable data for the client
  const variableData = await generateVariableData(client, variableContext, 'client_bio', ['full_session_contents']);
  
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
