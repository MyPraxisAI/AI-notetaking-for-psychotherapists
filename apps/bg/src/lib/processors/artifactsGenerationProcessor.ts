import { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateArtifact } from '@kit/web-bg-common';
import { getBackgroundLogger, createLoggerContext } from '../logger';

/**
 * Artifacts Generation Task Data
 */
export interface ArtifactsGenerateTaskData {
  operation: 'artifacts:generate';
  accountId: string;
  sessionId: string;
  priority?: 'high' | 'normal' | 'low';
  idempotencyKey?: string;
}

/**
 * Extended error interface for combined artifact generation errors
 */
interface CombinedArtifactError extends Error {
  failedArtifacts: string[];
  sessionId: string;
  clientId: string;
  totalArtifacts: number;
  failedCount: number;
}

/**
 * Artifacts Generation Processor
 * Handles processing of artifact generation tasks
 */
export class ArtifactsGenerationProcessor {
  /**
   * Process an artifacts generation task
   * @param supabase - Supabase client
   * @param task - The artifacts generation task data
   * @param _messageId - The SQS message ID
   */
  public async process(
    supabase: SupabaseClient,
    task: ArtifactsGenerateTaskData,
    _messageId: string
  ): Promise<void> {
    const logger = await getBackgroundLogger();
    
    try {
      const { accountId, sessionId } = task;
      
      logger.info(createLoggerContext('artifactsGenerationProcessor', { accountId, sessionId }), 'Processing artifacts generation');
      
      // 1. Generate key artifacts for this session and its client
      await this.regenerateArtifacts(supabase, task);
      
      logger.info(createLoggerContext('artifactsGenerationProcessor', { accountId, sessionId }), 'Successfully processed artifacts generation');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(createLoggerContext('artifactsGenerationProcessor', { error }), `Error processing artifacts generation: ${errorMessage}`);
      throw error; // Rethrow to prevent message deletion
    }
  }
  
  /**
   * Regenerate artifacts for a session and its client
   * @param supabase - Supabase client
   * @param task - The artifacts generation task data
   */
  private async regenerateArtifacts(
    supabase: SupabaseClient,
    task: ArtifactsGenerateTaskData
  ): Promise<void> {
    const { sessionId } = task;
    const logger = await getBackgroundLogger();
    
    try {
      // 1. Get the client ID for this session
      const { data: sessionData, error: sessionFetchError } = await supabase
        .from('sessions')
        .select('client_id')
        .eq('id', sessionId)
        .single();
        
      if (sessionFetchError) {
        logger.error(createLoggerContext('artifactsGenerationProcessor', { error: sessionFetchError }), 'Error fetching session data');
        throw sessionFetchError;
      }
      
      const clientId = sessionData?.client_id;
      
      if (!clientId) {
        logger.error(createLoggerContext('artifactsGenerationProcessor', { sessionId }), 'No client ID found for session, cannot generate artifacts');
        throw new Error(`No client ID found for session ${sessionId}`);
      }
      
      logger.info(createLoggerContext('artifactsGenerationProcessor', { sessionId, clientId }), 'Generating artifacts for session and client');
      
      // Define the artifacts to generate in specific order
      // TODO: build dynamic dependence graph of the artifacts. 
      // Generating them in the wrong order is also OK technically (already generated ones will be served from cache)
      const artifactsToGenerate = [
        { referenceId: sessionId, referenceType: 'session' as const, type: 'session_therapist_summary' as const },
        { referenceId: sessionId, referenceType: 'session' as const, type: 'session_client_summary' as const },
        { referenceId: clientId, referenceType: 'client' as const, type: 'client_bio' as const },
        { referenceId: clientId, referenceType: 'client' as const, type: 'client_conceptualization' as const },
        { referenceId: clientId, referenceType: 'client' as const, type: 'client_prep_note' as const }
      ];
      
      // Collect errors from artifact generation
      const errors: Array<{ artifactType: string; error: unknown }> = [];
      
      // Process artifacts in sequence to avoid overwhelming the system
      for (const artifactConfig of artifactsToGenerate) {
        try {
          logger.info(createLoggerContext('artifactsGenerationProcessor', { 
            artifactType: artifactConfig.type, 
            referenceType: artifactConfig.referenceType, 
            referenceId: artifactConfig.referenceId 
          }), `Generating ${artifactConfig.type}`);
          
          // Use getOrCreateArtifact to generate or regenerate the artifact
          // Language will be automatically determined by the function
          const { isNew } = await getOrCreateArtifact(
            supabase,
            artifactConfig.referenceId,
            artifactConfig.referenceType,
            artifactConfig.type
          );
          
          logger.info(createLoggerContext('artifactsGenerationProcessor', { 
            artifactType: artifactConfig.type, 
            referenceType: artifactConfig.referenceType, 
            referenceId: artifactConfig.referenceId,
            isNew 
          }), `Successfully generated ${artifactConfig.type}`);
        } catch (error) {
          logger.error(createLoggerContext('artifactsGenerationProcessor', { 
            error, 
            artifactType: artifactConfig.type, 
            referenceType: artifactConfig.referenceType, 
            referenceId: artifactConfig.referenceId 
          }), `Error generating artifact ${artifactConfig.type}`);
          
          // Collect the error to throw later
          errors.push({ artifactType: artifactConfig.type, error });
        }
      }
      
      // If there were any errors, throw a combined error
      if (errors.length > 0) {
        const errorMessages = errors.map(({ artifactType, error }) => 
          `${artifactType}: ${error instanceof Error ? error.message : String(error)}`
        ).join('; ');
        
        const combinedError = new Error(
          `Failed to generate ${errors.length}/${artifactsToGenerate.length} artifacts for session ${sessionId}, client ${clientId}: ${errorMessages}`
        );
        
        // Add additional context to the error object for debugging
        (combinedError as CombinedArtifactError).failedArtifacts = errors.map(e => e.artifactType);
        (combinedError as CombinedArtifactError).sessionId = sessionId;
        (combinedError as CombinedArtifactError).clientId = clientId;
        (combinedError as CombinedArtifactError).totalArtifacts = artifactsToGenerate.length;
        (combinedError as CombinedArtifactError).failedCount = errors.length;
        
        throw combinedError;
      }
      
      logger.info(createLoggerContext('artifactsGenerationProcessor', { sessionId, clientId }), 'Completed artifact generation for session and client');
    } catch (error) {
      logger.error(createLoggerContext('artifactsGenerationProcessor', { error, sessionId }), 'Error generating artifacts for session');
      throw error;
    }
  }
}
