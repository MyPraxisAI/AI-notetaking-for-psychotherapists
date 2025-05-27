import { z } from 'zod';

// Client schema for validation
export const ClientSchema = z.object({
  fullName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal(''))
});

// Type for client data from UI
export type ClientData = z.infer<typeof ClientSchema>;

// Database record type (snake_case)
export interface ClientRecord {
  id: string;
  created_at: string;
  updated_at: string;
  account_id: string;
  therapist_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  demo: boolean;
}

// Client with ID for frontend use
export interface ClientWithId extends ClientData {
  id: string;
  createdAt: string;
  demo: boolean;
}
