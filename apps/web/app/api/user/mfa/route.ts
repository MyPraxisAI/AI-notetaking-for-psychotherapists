import { NextResponse } from 'next/server';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

// Type assertion to allow access to custom tables
type CustomClient = SupabaseClient & {
  from: (table: string) => any;
};

// Define the schema here instead of importing
const MFASettingsSchema = z.object({
  mfaEnabled: z.boolean(),
  phoneNumber: z.string().optional().nullable(),
});

// Initialize logger
const logger = await getLogger();

export const PUT = enhanceRouteHandler(
  async ({ request, user }) => {
    const ctx = {
      name: 'update-mfa-settings',
      userId: user.id,
    };

    logger.info(ctx, 'Processing MFA settings update request');

    try {
      const data = await request.json();
      const validatedData = MFASettingsSchema.parse(data);
      
      logger.info(ctx, 'Updating MFA settings...');

      const client = getSupabaseServerClient();

      // Update MFA settings in user profile
      const { error } = await client.auth.updateUser({
        phone: validatedData.phoneNumber || undefined,
        data: {
          mfa_enabled: validatedData.mfaEnabled,
        },
      });

      if (error) {
        logger.error(ctx, 'Failed to update MFA settings', { error });
        return NextResponse.json({ error: 'Failed to update MFA settings' }, { status: 500 });
      }

      logger.info(ctx, 'MFA settings updated successfully');
      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error(ctx, 'Failed to update MFA settings', { error });
      
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'Unknown error' },
        { status: 400 }
      );
    }
  },
  {
    auth: true,
  }
);
