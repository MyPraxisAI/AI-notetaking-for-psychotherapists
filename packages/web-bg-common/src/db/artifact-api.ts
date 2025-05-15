import { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '../logger';
import type { ArtifactType, LanguageType } from '../types';

/**
 * Get an artifact from the database
 * @param client Supabase client
 * @param referenceId ID of the reference (session or client)
 * @param referenceType Type of reference ('session' or 'client')
 * @param type Artifact type
 * @param language Language of the artifact
 * @returns Artifact data or null if not found
 */
export async function getArtifact(
  client: SupabaseClient,
  referenceId: string,
  referenceType: 'session' | 'client',
  type: ArtifactType,
  language: LanguageType
) {
  const logger = await getLogger();
  const ctx = {
    name: 'get-artifact',
    referenceId,
    referenceType,
    type,
    language
  };
  
  try {
    logger.info(ctx, `Fetching ${type} artifact from database`);
    
    const { data, error } = await client
      .from('artifacts')
      .select('id, content, language, stale')
      .eq('reference_id', referenceId)
      .eq('reference_type', referenceType)
      .eq('type', type)
      .eq('language', language)
      .maybeSingle();
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    logger.error(ctx, `Error fetching ${type} artifact:`, { error });
    throw error;
  }
}

/**
 * Update an existing artifact in the database
 * @param client Supabase client
 * @param artifactId ID of the artifact to update
 * @param content New artifact content
 * @returns Success status
 */
export async function updateArtifact(
  client: SupabaseClient,
  artifactId: string,
  content: string
): Promise<boolean> {
  const logger = await getLogger();
  const ctx = {
    name: 'update-artifact',
    artifactId
  };
  
  try {
    logger.info(ctx, `Updating artifact ${artifactId}`);
    
    // Always set stale to false when updating content
    const updateData = { content, stale: false };
    
    const { error } = await client
      .from('artifacts')
      .update(updateData)
      .eq('id', artifactId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    logger.error(ctx, `Error updating artifact:`, { error });
    throw error;
  }
}

/**
 * Create a new artifact in the database
 * @param client Supabase client
 * @param referenceId ID of the reference (session or client)
 * @param referenceType Type of reference ('session' or 'client')
 * @param type Artifact type
 * @param content Artifact content
 * @param language Language of the artifact
 * @returns Success status
 */
export async function createArtifact(
  client: SupabaseClient,
  referenceId: string,
  referenceType: 'session' | 'client',
  type: ArtifactType,
  content: string,
  language: LanguageType
): Promise<boolean> {
  const logger = await getLogger();
  const ctx = {
    name: 'create-artifact',
    referenceId,
    referenceType,
    type,
    language
  };
  
  try {
    logger.info(ctx, `Creating new ${type} artifact`);
    
    const insertData = {
      reference_id: referenceId,
      reference_type: referenceType,
      type,
      content,
      language,
      stale: false // Always set stale to false for new artifacts
    };
    
    const { error } = await client
      .from('artifacts')
      .insert(insertData);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    logger.error(ctx, `Error creating ${type} artifact:`, { error });
    throw error;
  }
}

/**
 * Save an artifact to the database (create or update)
 * @param client Supabase client
 * @param referenceId ID of the reference (session or client)
 * @param referenceType Type of reference ('session' or 'client')
 * @param type Artifact type
 * @param content Artifact content
 * @param language Language of the artifact
 * @returns Success status
 */
export async function saveArtifact(
  client: SupabaseClient,
  referenceId: string,
  referenceType: 'session' | 'client',
  type: ArtifactType,
  content: string,
  language: LanguageType
): Promise<boolean> {
  const logger = await getLogger();
  const ctx = {
    name: 'save-artifact',
    referenceId,
    referenceType,
    type,
    language
  };
  
  try {
    logger.info(ctx, `Saving ${type} artifact to database`);
    
    // Check if the artifact already exists
    const existingArtifact = await getArtifact(client, referenceId, referenceType, type, language);
    
    if (existingArtifact) {
      // Update existing artifact
      logger.info(ctx, `Updating existing ${type} artifact`);
      return await updateArtifact(client, existingArtifact.id, content);
    } else {
      // Create new artifact
      logger.info(ctx, `Creating new ${type} artifact`);
      return await createArtifact(client, referenceId, referenceType, type, content, language);
    }
  } catch (error) {
    logger.error(ctx, `Error saving ${type} artifact:`, { error });
    throw error;
  }
}

/**
 * Invalidate all artifacts related to a specific session by marking them as stale
 * @param client Supabase client
 * @param sessionId ID of the session
 * @returns Number of artifacts marked as stale
 */
export async function invalidateSessionArtifacts(
  client: SupabaseClient,
  sessionId: string
): Promise<number> {
  const logger = await getLogger();
  const ctx = {
    name: 'invalidate-session-artifacts',
    sessionId
  };
  
  try {
    logger.info(ctx, `Invalidating all artifacts for session ${sessionId}`);
    
    const { error, count } = await client
      .from('artifacts')
      .update({ stale: true })
      .eq('reference_type', 'session')
      .eq('reference_id', sessionId);
    
    if (error) throw error;
    
    const updatedCount = count || 0;
    logger.info(ctx, `Marked ${updatedCount} session artifacts as stale`);
    return updatedCount;
  } catch (error) {
    logger.error(ctx, `Error invalidating session artifacts:`, { error });
    throw error;
  }
}

/**
 * Invalidate all artifacts related to a specific client by marking them as stale
 * @param client Supabase client
 * @param clientId ID of the client
 * @returns Number of artifacts marked as stale
 */
export async function invalidateClientArtifacts(
  client: SupabaseClient,
  clientId: string
): Promise<number> {
  const logger = await getLogger();
  const ctx = {
    name: 'invalidate-client-artifacts',
    clientId
  };
  
  try {
    logger.info(ctx, `Invalidating all artifacts for client ${clientId}`);
    
    const { error, count } = await client
      .from('artifacts')
      .update({ stale: true })
      .eq('reference_type', 'client')
      .eq('reference_id', clientId);
    
    if (error) throw error;
    
    const updatedCount = count || 0;
    logger.info(ctx, `Marked ${updatedCount} client artifacts as stale`);
    return updatedCount;
  } catch (error) {
    logger.error(ctx, `Error invalidating client artifacts:`, { error });
    throw error;
  }
}

/**
 * Invalidate all artifacts related to a specific session and its associated client
 * @param client Supabase client
 * @param sessionId ID of the session
 * @returns Object with counts of session and client artifacts marked as stale
 */
export async function invalidateSessionAndClientArtifacts(
  client: SupabaseClient,
  sessionId: string
): Promise<{ sessionCount: number; clientCount: number }> {
  const logger = await getLogger();
  const ctx = {
    name: 'invalidate-session-and-client-artifacts',
    sessionId
  };
  
  try {
    logger.info(ctx, `Invalidating session artifacts and finding associated client`);
    
    // First, mark session artifacts as stale
    const sessionCount = await invalidateSessionArtifacts(client, sessionId);
    
    // Then, find the client ID associated with this session
    const { data: sessionData, error: sessionError } = await client
      .from('sessions')
      .select('client_id')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) throw sessionError;
    
    if (!sessionData || !sessionData.client_id) {
      logger.info(ctx, `No client found for session ${sessionId}`);
      return { sessionCount, clientCount: 0 };
    }
    
    const clientId = sessionData.client_id;
    logger.info(ctx, `Found client ${clientId} for session ${sessionId}`);
    
    // Finally, mark client artifacts as stale
    const clientCount = await invalidateClientArtifacts(client, clientId);
    
    return { sessionCount, clientCount };
  } catch (error) {
    logger.error(ctx, `Error invalidating session and client artifacts:`, { error });
    throw error;
  }
}
