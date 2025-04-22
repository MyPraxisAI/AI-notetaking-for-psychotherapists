import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserLanguage } from '../../../../../../lib/utils/language';
import type { ArtifactType, LanguageType } from '../../../../../../lib/utils/artifacts';
import { generateArtifact, saveArtifact } from '../../../../../../lib/utils/artifacts';
import { createPromptApi } from '../../../../../../app/home/(user)/mypraxis/_lib/api/prompt-api';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Extract variables from a template string
 * @param templateString The template string to extract variables from
 * @returns Array of variable names
 */
function extractTemplateVariables(templateString: string): string[] {
  const variableRegex = /\{\{\s*([a-z_]+)\s*\}\}/g;
  const variables = new Set<string>();
  let match: RegExpExecArray | null;
  
  while ((match = variableRegex.exec(templateString)) !== null) {
    const variableName = match[1];
    // Skip global variables that are handled at a lower level
    if (variableName && variableName !== 'language' && variableName !== 'primary_therapeutic_approach') {
      variables.add(variableName);
    }
  }
  
  return Array.from(variables);
}

/**
 * Validate that all template variables have corresponding generators
 * @param variables Array of variable names to validate
 * @throws Error if any variable doesn't have a generator
 */
function validateTemplateVariables(variables: string[]): void {
  const supportedVariables = [
    'full_session_contents',
    'last_session_content',
    'session_summaries',
    'client_conceptualization',
    'client_bio'
  ];
  
  for (const variable of variables) {
    if (!supportedVariables.includes(variable)) {
      throw new Error(`Unsupported template variable: ${variable}`);
    }
  }
}

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
    .select('id, title, note, transcript, created_at, updated_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching sessions:', error);
  }

  // Format the session data for the prompt
  return sessions && sessions.length > 0 ? sessions.map((session: { id: string; title?: string; transcript?: string; note?: string; created_at: string }) => {
    const date = new Date(session.created_at).toLocaleDateString();
    let content = `## Session on ${date} - ${session.title || 'Untitled'}\n\n`;
    
    if (session.transcript) {
      content += `### Transcript:\n${session.transcript}\n\n`;
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
    .select('id, title, note, transcript, created_at, updated_at')
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
  
  const date = new Date(lastSession.created_at).toLocaleDateString();
  let content = `## Session on ${date} - ${lastSession.title || 'Untitled'}\n\n`;
  
  if (lastSession.transcript) {
    content += `### Transcript:\n${lastSession.transcript}\n\n`;
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
 * Get an existing artifact or create a new one if it doesn't exist
 * @param client Supabase client
 * @param clientId Client ID
 * @param artifactType Type of artifact to get or create
 * @param userLanguage User's preferred language
 * @returns Artifact content and metadata
 */
async function getOrCreateArtifact(
  client: SupabaseClient,
  clientId: string,
  artifactType: ArtifactType,
  userLanguage: LanguageType
): Promise<{ content: string; language: string; isNew: boolean }> {
  try {
    console.log(`[Artifact:${artifactType}] Checking if artifact exists for client ${clientId}`);
    // Check if the artifact already exists in the database
    const { data: existingArtifact } = await client
      .from('artifacts')
      .select('content, language')
      .eq('reference_type', 'client')
      .eq('reference_id', clientId)
      .eq('type', artifactType)
      .maybeSingle();
    
    // If the artifact exists, return it
    if (existingArtifact) {
      console.log(`[Artifact:${artifactType}] Found existing artifact for client ${clientId}`);
      return {
        content: existingArtifact.content,
        language: existingArtifact.language,
        isNew: false
      };
    }
    
    // If the artifact doesn't exist, generate it
    console.log(`[Artifact:${artifactType}] Not found for client ${clientId}, generating new artifact...`);
    
    // Get the prompt template to extract variables
    console.log(`[Artifact:${artifactType}] Fetching prompt template`);
    const promptApi = createPromptApi(client);
    const promptData = await promptApi.getPromptByArtifactType(artifactType);
    const templateString = promptData.template;
    console.log(`[Artifact:${artifactType}] Using model: ${promptData.model}`);
    
    // Extract variables from the template
    const variables = extractTemplateVariables(templateString);
    
    // Validate that we can generate all required variables
    validateTemplateVariables(variables);
    
    // Generate data for all variables
    const variableData = await generateVariableData(client, clientId, artifactType, variables);
    
    // Generate the artifact using the variable data
    console.log(`[Artifact:${artifactType}] Starting artifact generation with OpenAI`);
    const startTime = Date.now();
    let content;
    try {
      content = await generateArtifact(artifactType, variableData);
      const duration = Date.now() - startTime;
      console.log(`[Artifact:${artifactType}] Generation completed successfully in ${duration}ms`);
    } catch (genError) {
      const duration = Date.now() - startTime;
      console.error(`[Artifact:${artifactType}] Generation failed after ${duration}ms:`, genError);
      throw genError;
    }
    
    // Save the generated artifact to the database
    await saveArtifact(client, clientId, 'client', artifactType, content, userLanguage);
    
    return {
      content,
      language: userLanguage,
      isNew: true
    };
  } catch (error) {
    console.error(`[Artifact:${artifactType}] Error getting or creating artifact for client ${clientId}:`, error);
    
    // Check for timeout errors specifically
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');
    
    if (isTimeout) {
      console.error(`[Artifact:${artifactType}] Request timed out. This could be due to high server load or an issue with the OpenAI API.`);
      return {
        content: `We're sorry, but we couldn't generate this content at the moment due to high demand. Please try again later.`,
        language: userLanguage,
        isNew: true
      };
    }
    
    throw new Error(`Failed to get or create ${artifactType}: ${errorMessage}`);
  }
}

/**
 * Generate or fetch client conceptualization
 * @param client Supabase client
 * @param clientId Client ID
 * @returns Client conceptualization content
 */
async function generateClientConceptualization(client: SupabaseClient, clientId: string): Promise<string> {
  // Get the user's preferred language
  const userLanguage = await getUserLanguage() as LanguageType;
  
  // Get or create the conceptualization
  const { content } = await getOrCreateArtifact(
    client,
    clientId,
    'client_conceptualization',
    userLanguage
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
  const userLanguage = await getUserLanguage() as LanguageType;
  
  // Get or create the bio
  const { content } = await getOrCreateArtifact(
    client,
    clientId,
    'client_bio',
    userLanguage
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
    const userLanguage = await getUserLanguage() as LanguageType;
    
    try {
      // Get or create the artifact
      const { content, language, isNew } = await getOrCreateArtifact(client, clientId, artifactType, userLanguage);
      
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
