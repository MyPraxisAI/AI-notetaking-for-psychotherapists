/**
 * Common type definitions for MyPraxis web and bg applications
 * These types are safe to use in any environment (browser, server, etc.)
 */

/**
 * Artifact type definitions
 */
export type ArtifactType = 
  | 'session_therapist_summary' 
  | 'session_client_summary' 
  | 'client_prep_note' 
  | 'client_conceptualization' 
  | 'client_bio'
  | 'session_speaker_roles_classification';

/**
 * Prompt source type
 */
export type PromptSourceType = 
  | { type: 'artifact_type'; value: ArtifactType }
  | { type: 'name'; value: string };

/**
 * Language type
 */
export type LanguageType = 'en' | 'ru';

/**
 * Context for variable generation
 */
export interface VariableContext {
  /** Type of context ('session' or 'client') */
  contextType?: 'session' | 'client';
  /** ID of the context (session or client) */
  contextId?: string;
}

/**
 * Prompt data interface
 */
export interface PromptData {
  id: string;
  artifact_type: ArtifactType | null;
  name: string | null;
  template: string;
  provider: string;
  model: string;
  parameters: Record<string, string | number | boolean | null>;
}

/**
 * Prompt API interface
 */
export interface PromptApi {
  getPromptByArtifactType(artifactType: ArtifactType): Promise<PromptData>;
  getPromptByName(name: string): Promise<PromptData>;
  getAllActivePrompts(): Promise<PromptData[]>;
}
