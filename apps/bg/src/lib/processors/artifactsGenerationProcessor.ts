import { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateArtifact } from '@kit/web-bg-common';
import { getArtifact } from '@kit/web-bg-common/db/artifact-api';
import { getBackgroundLogger, createLoggerContext } from '../logger';
import { Message } from 'aws-sdk/clients/sqs';

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
    try {
      const { accountId, sessionId } = task;
      
      console.log(`Processing artifacts generation: accountId=${accountId}, sessionId=${sessionId}`);
      
      // 1. Generate key artifacts for this session and its client
      await this.regenerateArtifacts(supabase, task);
      
      console.log(`Successfully processed artifacts generation for session ${sessionId}`);
    } catch (error: any) {
      const logger = await getBackgroundLogger();
      logger.error(createLoggerContext('artifactsGenerationProcessor', { error }), `Error processing artifacts generation: ${error.message}`);
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
    
    try {
      // 1. Get the client ID for this session
      const { data: sessionData, error: sessionFetchError } = await supabase
        .from('sessions')
        .select('client_id')
        .eq('id', sessionId)
        .single();
        
      if (sessionFetchError) {
        console.error('Error fetching session data:', sessionFetchError);
        throw sessionFetchError;
      }
      
      const clientId = sessionData?.client_id;
      
      if (!clientId) {
        console.error(`No client ID found for session ${sessionId}, cannot generate artifacts`);
        throw new Error(`No client ID found for session ${sessionId}`);
      }
      
      console.log(`Generating artifacts for session ${sessionId} and client ${clientId}`);
      
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
      
      // Process artifacts in sequence to avoid overwhelming the system
      for (const artifactConfig of artifactsToGenerate) {
        try {
          console.log(`Generating ${artifactConfig.type} for ${artifactConfig.referenceType} ${artifactConfig.referenceId}`);
          
          // Use getOrCreateArtifact to generate or regenerate the artifact
          // Language will be automatically determined by the function
          const { content, isNew } = await getOrCreateArtifact(
            supabase,
            artifactConfig.referenceId,
            artifactConfig.referenceType,
            artifactConfig.type
          );
          
          console.log(`Successfully generated ${artifactConfig.type} for ${artifactConfig.referenceType} ${artifactConfig.referenceId}, isNew=${isNew}`);
        } catch (error) {
          console.error(`Error generating artifact ${artifactConfig.type}:`, error);
          // Continue with other artifacts even if one fails
        }
      }
      
      console.log(`Completed artifact generation for session ${sessionId} and client ${clientId}`);
    } catch (error) {
      console.error(`Error generating artifacts for session ${sessionId}:`, error);
      throw error;
    }
  }
}
