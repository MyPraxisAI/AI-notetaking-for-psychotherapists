import { z } from 'zod';

// Define the invite status enum to match the database
export const InviteStatusEnum = z.enum(['pending', 'accepted', 'expired', 'revoked']);
export type InviteStatus = z.infer<typeof InviteStatusEnum>;

// Schema for creating a new invitation
export const CreatePersonalInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  expiresInDays: z.number().int().positive().default(7),
  language: z.string().min(2).max(5).default('en')
});

export type CreatePersonalInviteData = z.infer<typeof CreatePersonalInviteSchema>;

// Schema for accepting an invitation
export const AcceptPersonalInviteSchema = z.object({
  token: z.string().min(1, 'Token is required')
});

export type AcceptPersonalInviteData = z.infer<typeof AcceptPersonalInviteSchema>;

// Schema for revoking an invitation
export const RevokePersonalInviteSchema = z.object({
  id: z.string().uuid('Invalid invitation ID')
});

export type RevokePersonalInviteData = z.infer<typeof RevokePersonalInviteSchema>;

// Schema for resending an invitation email
export const ResendPersonalInviteSchema = z.object({
  id: z.string().uuid('Invalid invitation ID')
});

export type ResendPersonalInviteData = z.infer<typeof ResendPersonalInviteSchema>;

// The full personal invite type (matches database schema)
export const PersonalInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  token: z.string(),
  invited_by_account_id: z.string().uuid(),
  accepted_at: z.string().datetime().nullable(),
  invited_account_id: z.string().uuid().nullable(),
  status: InviteStatusEnum,
  language: z.string().min(2).max(5).default('en')
});

export type PersonalInvite = z.infer<typeof PersonalInviteSchema>;
