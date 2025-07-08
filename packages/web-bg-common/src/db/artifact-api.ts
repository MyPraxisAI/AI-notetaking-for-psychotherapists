import { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@kit/shared-common';
import type { ArtifactType, LanguageType } from '../types';

/**
 * Get an artifact from the database
 * @param client Supabase client
 * @param referenceId ID of the reference (session or client)
 * @param referenceType Type of reference ('session' or 'client')
 * @param type Artifact type
 * @returns Artifact data or null if not found
 */
export async function getArtifact(
  client: SupabaseClient,
  referenceId: string,
  referenceType: 'session' | 'client',
  type: ArtifactType
) {
  
  const logger = await getLogger();
  const ctx = {
    name: 'get-artifact',
    referenceId,
    referenceType,
    type
  };
  
  try {
    logger.info(ctx, `Fetching ${type} artifact from database`);
    
    const { data, error } = await client
      .from('artifacts')
      .select('id, content, language, stale')
      .eq('reference_id', referenceId)
      .eq('reference_type', referenceType)
      .eq('type', type)
      .maybeSingle();
    
    if (error) {
      // PGRST116: No rows found
      if (error.code === 'PGRST116') {
        logger.info(ctx, `Artifact not found`);
        return null;
      }
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(ctx, `Error fetching ${type} artifact:`, { error });
    throw error;
  }
}

/**
 * Get multiple artifacts from the database in a single query
 * @param client Supabase client
 * @param referenceIds Array of reference IDs (e.g., session IDs or client IDs)
 * @param referenceType Type of reference ('session' or 'client')
 * @param type Type of artifact
 * @returns Array of artifacts
 */
export async function getArtifacts(
  client: SupabaseClient,
  referenceIds: string[],
  referenceType: 'session' | 'client',
  type: ArtifactType
) {
  const logger = await getLogger();
  const ctx = {
    name: 'get-artifacts',
    referenceType,
    type,
    referenceCount: referenceIds.length
  };
  
  // If no reference IDs, return empty array
  if (!referenceIds.length) {
    return [];
  }
  
  try {
    logger.info(ctx, `Fetching ${type} artifacts for ${referenceIds.length} references`);
    
    const { data, error } = await client
      .from('artifacts')
      .select('id, reference_id, content, language, stale')
      .in('reference_id', referenceIds)
      .eq('reference_type', referenceType)
      .eq('type', type);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error(ctx, `Error fetching ${type} artifacts:`, { error });
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
 * Create a new artifact
 * @param client Supabase client or transaction client
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
    
    // First attempt an upsert operation with ON CONFLICT DO UPDATE
    // This is a more robust approach that handles concurrency at the database level
    const { data, error } = await client
      .from('artifacts')
      .upsert(
        {
          reference_id: referenceId,
          reference_type: referenceType,
          type,
          content,
          language,
          stale: false, // Set stale to false when saving
          updated_at: new Date().toISOString() // Update the timestamp
        },
        {
          // Use a composite unique constraint to identify existing records
          onConflict: 'reference_type,reference_id,type',
          // Specify which fields to update if a record exists
          ignoreDuplicates: false
        }
      )
      .select();
    
    if (error) {
      logger.error(ctx, `Error upserting artifact:`, { error });
      throw error;
    }
    
    const isNew = !data || data.length === 0 || !data[0].id;
    logger.info(ctx, `${isNew ? 'Created new' : 'Updated existing'} ${type} artifact`);
    
    return true;
  } catch (error) {
    logger.error(ctx, `Error saving ${type} artifact:`, { error });
    throw error;
  }
}

/**
 * Invalidate all artifacts related to a specific session by marking them as stale
 * @param client Supabase client
 * @param sessionId ID of the session
 */
export async function invalidateSessionArtifacts(
  client: SupabaseClient,
  sessionId: string
): Promise<void> {
  const logger = await getLogger();
  const ctx = {
    name: 'invalidate-session-artifacts',
    sessionId
  };
  
  try {
    logger.info(ctx, `Invalidating all artifacts for session ${sessionId}`);
    
    const { error } = await client
      .from('artifacts')
      .update({ stale: true })
      .eq('reference_type', 'session')
      .eq('reference_id', sessionId);
    
    if (error) throw error;
    
    logger.info(ctx, `Marked session artifacts as stale`);
  } catch (error) {
    logger.error(ctx, `Error invalidating session artifacts:`, { error });
    throw error;
  }
}

/**
 * Invalidate all artifacts related to a specific client by marking them as stale
 * @param client Supabase client
 * @param clientId ID of the client
 */
export async function invalidateClientArtifacts(
  client: SupabaseClient,
  clientId: string
): Promise<void> {
  const logger = await getLogger();
  const ctx = {
    name: 'invalidate-client-artifacts',
    clientId
  };
  
  try {
    logger.info(ctx, `Invalidating all artifacts for client ${clientId}`);
    
    const { error } = await client
      .from('artifacts')
      .update({ stale: true })
      .eq('reference_type', 'client')
      .eq('reference_id', clientId);
    
    if (error) throw error;
    
    logger.info(ctx, `Marked client artifacts as stale`);
  } catch (error) {
    logger.error(ctx, `Error invalidating client artifacts:`, { error });
    throw error;
  }
}

/**
 * Invalidate all artifacts related to a specific session and its associated client
 * @param client Supabase client
 * @param sessionId ID of the session
 */
export async function invalidateSessionAndClientArtifacts(
  client: SupabaseClient,
  sessionId: string
): Promise<void> {
  const logger = await getLogger();
  const ctx = {
    name: 'invalidate-session-and-client-artifacts',
    sessionId
  };
  
  try {
    logger.info(ctx, `Invalidating session artifacts and finding associated client`);
    
    // First, mark session artifacts as stale
    await invalidateSessionArtifacts(client, sessionId);
    
    // Then, find the client ID associated with this session
    const { data: sessionData, error: sessionError } = await client
      .from('sessions')
      .select('client_id')
      .eq('id', sessionId)
      .single();
    
    if (sessionError) throw sessionError;
    
    if (!sessionData || !sessionData.client_id) {
      logger.error(ctx, `No client found for session ${sessionId}`);
      return;
    }
    
    const clientId = sessionData.client_id;
    
    // Finally, mark client artifacts as stale
    await invalidateClientArtifacts(client, clientId);
  } catch (error) {
    logger.error(ctx, `Error invalidating session and client artifacts:`, { error });
    throw error;
  }
}
