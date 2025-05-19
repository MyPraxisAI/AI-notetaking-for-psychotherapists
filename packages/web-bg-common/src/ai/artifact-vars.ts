import { SupabaseClient } from '@supabase/supabase-js';
import { getArtifact, getArtifacts } from '../db/artifact-api';
import { getUserLanguage, getOrCreateArtifact, getFullLanguageName, createTherapistApi } from '..';
import type { ArtifactType, LanguageType, VariableContext } from '../types';
import { getLogger } from '../logger';

/**
 * Generate the full language name based on user preferences
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Full language name (e.g., 'English' for 'en')
 */
export async function generateLanguage(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-language',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown'
  };
  
  logger.info(ctx, 'Getting user language preference');
  
  // Get the user's preferred language
  const language = await getUserLanguage(client) as LanguageType;
  
  // Convert language code to full name
  const fullLanguageName = getFullLanguageName(language);
  
  logger.info(ctx, `User language: ${language}, Full name: ${fullLanguageName}`);
  return fullLanguageName;
}

/**
 * Generate the primary therapeutic approach for the therapist
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Primary therapeutic approach title
 */
export async function generatePrimaryTherapeuticApproach(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-primary-therapeutic-approach',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown'
  };
  
  logger.info(ctx, 'Getting primary therapeutic approach');
  
  // Get the primary therapeutic approach using the Therapist API
  const therapistApi = createTherapistApi(client);
  const therapeuticApproach = await therapistApi.getPrimaryTherapeuticApproach();
  const primaryApproach = therapeuticApproach.title;
  
  logger.info(ctx, `Primary therapeutic approach: ${primaryApproach}`);
  return primaryApproach;
}

/**
 * Extract variables from a template string
 * @param templateString The template string to extract variables from
 * @returns Array of variable names
 */
export function extractTemplateVariables(templateString: string): string[] {
  const variableRegex = /\{\{\s*([a-z_]+)\s*\}\}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null;
  
  while ((match = variableRegex.exec(templateString)) !== null) {
    const variableName = match[1];
    variables.add(variableName);
  }
  
  return Array.from(variables);
}

// Define the variable generators at the module level so they can be referenced by validateTemplateVariables
const variableGenerators: Record<string, (client: SupabaseClient, context?: VariableContext) => Promise<string>> = {
  full_session_contents: generateFullSessionContents, // client
  last_session_content: generateLastSessionContent, // client
  session_summaries: generateSessionSummaries, // client, artifact
  session_transcript: generateSessionTranscript, // session
  session_note: generateSessionNote, // session
  client_conceptualization: generateClientConceptualization, // client, artifact
  client_bio: generateClientBio, // client, artifact
  previous_client_bio: generatePreviousClientBio, // client, artifact
  language: generateLanguage, // global
  primary_therapeutic_approach: generatePrimaryTherapeuticApproach // global
};

/**
 * Check if a variable can be generated
 * @param variable The variable name to check
 * @returns True if the variable can be generated, false otherwise
 */
export function canGenerateVariable(variable: string): boolean {
  return Object.keys(variableGenerators).includes(variable);
}

/**
 * Generate data for template variables
 * @param client Supabase client
 * @param variableContext Optional context for variable generation
 * @param artifactType Artifact type
 * @param variables Array of variable names
 * @returns Object with variable data
 */
export async function generateVariableData(
  client: SupabaseClient,
  artifactType: ArtifactType,
  variables: string[],
  variableContext?: VariableContext
): Promise<Record<string, string>> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-variable-data',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown'
  };

  logger.info(ctx, `Generating variable data for ${artifactType}`);

  const variableData: Record<string, string> = {};

  for (const variable of variables) {
    variableData[variable] = await generateVariableValue(client, variable, variableContext);
  }
  
  return variableData;
}

/**
 * Generate a value for a specific template variable
 * @param client Supabase client
 * @param variableContext Optional context for variable generation
 * @param variable Variable name
 * @returns Generated value
 */
async function generateVariableValue(
  client: SupabaseClient,
  variable: string,
  variableContext?: VariableContext
): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-variable-value',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown',
    variable
  };

  logger.info(ctx, `Generating value for variable: ${variable}`);
  
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
 * @param variableContext Optional context for variable generation
 * @returns Formatted session contents
 */
export async function generateFullSessionContents(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
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
export async function generateLastSessionContent(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
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
 * @param variableContext Optional context for variable generation
 * @returns Formatted session summaries
 */
export async function generateSessionSummaries(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-session-summaries',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown'
  };
  
  // Validate that we have a client context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    logger.error(ctx, 'Invalid variable context for generating session summaries');
    throw new Error('Session summaries generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  logger.info(ctx, `Generating session summaries for client ${clientId}`);
  
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  try {
    // Fetch all sessions for the client, ordered by creation date (newest first)
    const { data: sessions, error: sessionsError } = await client
      .from('sessions')
      .select('id, title, created_at, note')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    
    if (sessionsError) {
      logger.error(ctx, 'Error fetching sessions:', { error: sessionsError });
      throw sessionsError;
    }
    
    if (!sessions || sessions.length === 0) {
      logger.info(ctx, 'No sessions found for client');
      return 'No session data available.';
    }
    
    // Get all session IDs
    const sessionIds = sessions.map(session => session.id);
    
    // Fetch all therapist summary artifacts in a single query
    const artifacts = await getArtifacts(
      client,
      sessionIds,
      'session',
      'session_therapist_summary'
    );
    
    logger.info(ctx, `Retrieved ${artifacts.length} therapist summaries for ${sessionIds.length} sessions`);
    
    // Create a map of artifacts by sessionId for faster lookup
    const artifactsMap: Record<string, any> = {};
    artifacts.forEach(artifact => {
      if (artifact && artifact.reference_id) {
        artifactsMap[artifact.reference_id] = artifact;
      }
    });
 
    // TODO: if any session therapist summary artifacts are missing or stale, regenerate them.
    // For now can assume that any changes to session therapist 

    // Format the session data with summaries
    const formattedSummaries = sessions.map((session: { id: string; title?: string; created_at: string; note?: string }) => {
      const date = new Date(session.created_at).toLocaleDateString();
      let content = `## Session on ${date} - ${session.title || 'Untitled'}\n\n`;
      
      // Get the matching artifact from the map
      const artifact = artifactsMap[session.id];
      
      // Add the therapist summary if available
      if (artifact && artifact.content) {
        content += `### Session Summary:\n${artifact.content}\n\n`;
      } else {
        content += `### No therapist summary available for this session.\n\n`;
      }
      
      // Add therapist notes if available
      if (session.note) {
        content += `### Therapist Notes:\n${session.note}\n\n`;
      }
      
      return content;
    }).join('---\n\n');
    
    logger.info(ctx, `Successfully generated summaries for ${artifacts.length} of ${sessions.length} sessions`);
    return formattedSummaries;
  } catch (error) {
    logger.error(ctx, 'Error generating session summaries:', { error });
    throw error;
  }
}

/**
 * Generate session note content
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Session note content
 */
export async function generateSessionNote(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-session-note',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown'
  };
  
  // Validate that we have a session context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'session' || !variableContext.contextId) {
    logger.error(ctx, 'Invalid variable context for generating session notes');
    throw new Error('Session notes generation requires a session context');
  }
  
  const sessionId = variableContext.contextId;
  
  // Fetch session data from the sessions table
  logger.info(ctx, `Fetching session data for session ${sessionId}`);
  const { data: sessionData, error: sessionError } = await client
    .from('sessions')
    .select('note')
    .eq('id', sessionId)
    .single();
    
  if (sessionError) {
    logger.error(ctx, 'Error fetching session data:', sessionError);
    return 'Error fetching session notes.';
  }
  
  if (!sessionData || !sessionData.note) {
    logger.warn(ctx, `No notes found for session ${sessionId}`);
    return 'No notes available for this session.';
  }
  
  logger.info(ctx, `Successfully retrieved notes for session ${sessionId}`);
  return sessionData.note;
}

/**
 * Generate session transcript content
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Session transcript content
 */
export async function generateSessionTranscript(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-session-transcript',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown'
  };
  
  // Validate that we have a session context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'session' || !variableContext.contextId) {
    logger.error(ctx, 'Invalid variable context for generating session transcript');
    throw new Error('Session transcript generation requires a session context');
  }
  
  const sessionId = variableContext.contextId;
  
  // Fetch transcript from the transcripts table
  logger.info(ctx, `Fetching transcript for session ${sessionId}`);
  const { data: transcriptData, error: transcriptError } = await client
    .from('transcripts')
    .select('content')
    .eq('session_id', sessionId)
    .maybeSingle();
    
  if (transcriptError) {
    logger.error(ctx, 'Error fetching transcript:', transcriptError);
    return 'Error fetching transcript data.';
  }
  
  if (!transcriptData || !transcriptData.content) {
    logger.warn(ctx, `No transcript found for session ${sessionId}`);
    return 'No transcript available for this session.';
  }
  
  logger.info(ctx, `Successfully retrieved transcript for session ${sessionId}`);
  return transcriptData.content;
}

/**
 * Generate client conceptualization
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Client conceptualization
 */
export async function generateClientConceptualization(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    throw new Error('Client conceptualization generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  // Generate variable data for the client
  const variableData = await generateVariableData(client, 'client_conceptualization', ['full_session_contents'], variableContext);
  
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
export async function generateClientBio(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  // Validate that we have a client context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    throw new Error('Client bio generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  // Generate variable data for the client
  const variableData = await generateVariableData(client, 'client_bio', ['full_session_contents'], variableContext);
  
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

/**
 * Generate previous client bio - simply fetches the existing client_bio artifact content
 * @param client Supabase client
 * @param variableContext Context for variable generation
 * @returns Client previous bio content or empty string if not found
 */
export async function generatePreviousClientBio(client: SupabaseClient, variableContext?: VariableContext): Promise<string> {
  const logger = await getLogger();
  const ctx = {
    name: 'generate-client-previous-bio',
    contextType: variableContext?.contextType || 'unknown',
    contextId: variableContext?.contextId || 'unknown'
  };
  
  // Validate that we have a client context type
  if (!variableContext || !variableContext.contextType || variableContext.contextType !== 'client' || !variableContext.contextId) {
    logger.error(ctx, 'Invalid variable context for generating client previous bio');
    throw new Error('Client previous bio generation requires a client context');
  }
  
  const clientId = variableContext.contextId;
  // Get the user's preferred language
  const userLanguage = await getUserLanguage(client) as LanguageType;
  
  try {
    // Simply fetch the existing client_bio artifact if it exists
    const artifact = await getArtifact(
      client,
      clientId,
      'client',
      'client_bio'
    );
    
    // Return the content if the artifact exists, otherwise return null
    if (artifact && artifact.content) {
      logger.info(ctx, 'Found existing client bio for previous bio variable');
      return artifact.content;
    } else {
      logger.info(ctx, 'No existing client bio found for previous bio variable');
      return '';
    }
  } catch (error) {
    logger.error(ctx, 'Error fetching client bio for previous bio variable:', { error });
    return '';
  }
}
