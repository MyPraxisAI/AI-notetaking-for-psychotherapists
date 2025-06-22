/**
 * @kit/web-bg-common
 * 
 * Shared utilities for MyPraxis web and bg applications
 * 
 * IMPORTANT: This package is intended for server-side use only.
 * It contains code that depends on Node.js APIs and will not work in browser environments.
 * In Next.js applications, only use this in Server Components, API routes, or server actions.
 * 
 * For client components, import types from '@kit/web-bg-common/types' instead.
 */

// Re-export database utilities
export * from './db';

// Re-export language utilities
export * from './language';

// Re-export AI utilities
export * from './ai/ai-service';
export * from './ai/models';

// Export specific functions from artifact-vars to avoid conflicts
export { 
  generateVariableData,
  generateFullSessionContents,
  generateLastSessionContent,
  generateSessionSummaries,
  generateSessionTranscript,
  generateSessionNote,
  generateClientConceptualization,
  generateClientBio,
  extractTemplateVariables,
  canGenerateVariable
} from './ai/artifact-vars';

// Export specific functions from artifacts to maintain backward compatibility
export { 
  generateContent,
  generateArtifact,
  getOrCreateArtifact,
  regenerateArtifactsForSession
} from './ai/artifacts';

// Re-export types for convenience in server contexts
export * from './types';

// Re-export AWS utilities
export * as aws from './aws';

// Re-export time utilities
export * from './utils/time';

// Re-export mime utilities
export * from './utils/mime';
