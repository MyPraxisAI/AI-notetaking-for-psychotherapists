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
  validateTemplateVariables
} from './ai/artifact-vars';

// Re-export logger utilities
export * from './logger';

// Re-export artifact utilities
export * from './artifacts';

// Re-export types for convenience in server contexts
export * from './types';
