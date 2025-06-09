/**
 * Main entry point - re-exports client-safe components by default
 * For server-only components, import from '@kit/personal-invitations/server'
 *
 * @example
 * // Client components
 * import { CreatePersonalInviteSchema } from '@kit/personal-invitations';
 * 
 * // Server components or server actions
 * import { createPersonalInviteEmailService } from '@kit/personal-invitations/server';
 */

// Re-export everything from client to maintain backward compatibility
export * from './client';
